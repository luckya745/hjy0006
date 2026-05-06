param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDir,

    [Parameter(Mandatory = $true)]
    [string]$OutFile
)

$ErrorActionPreference = "Stop"

function Get-Text {
    param([System.Xml.XmlNode]$Node)
    if ($null -eq $Node) { return "" }
    return (($Node.InnerText -replace "\s+", " ").Trim())
}

function Get-FirstText {
    param(
        [System.Xml.XmlNode]$Node,
        [string]$XPath
    )
    $found = $Node.SelectSingleNode($XPath)
    return Get-Text $found
}

function Get-NodeAttr {
    param(
        [System.Xml.XmlNode]$Node,
        [string]$Name
    )
    if ($null -eq $Node -or $null -eq $Node.Attributes[$Name]) { return "" }
    return $Node.Attributes[$Name].Value
}

function Get-Paragraphs {
    param([System.Xml.XmlNode]$Node)
    if ($null -eq $Node) { return @() }
    $paragraphs = @()
    foreach ($p in $Node.SelectNodes(".//paragraph|.//tr")) {
        $text = Get-Text $p
        if ($text.Length -gt 0) {
            $paragraphs += $text
        }
    }
    if ($paragraphs.Count -eq 0) {
        $fallback = Get-Text $Node
        if ($fallback.Length -gt 0) { $paragraphs += $fallback }
    }
    return $paragraphs
}

function Get-Section {
    param([System.Xml.XmlNode]$Node)
    $title = Get-FirstText $Node "./front/biblioData/title/mainTitle"
    $kind = Get-NodeAttr ($Node.SelectSingleNode("./front/biblioData")) "type"
    $authors = @()
    foreach ($author in $Node.SelectNodes("./front/biblioData/creator/author/name|./front/biblioData/contributor/author/name")) {
        $authorText = Get-Text $author
        if ($authorText.Length -gt 0) { $authors += $authorText }
    }
    $content = $Node.SelectSingleNode("./text/content")
    $children = @()
    foreach ($child in $Node.SelectNodes("./level5")) {
        $children += Get-Section $child
    }
    return [ordered]@{
        id = Get-NodeAttr $Node "id"
        title = $title
        kind = $kind
        authors = @($authors | Select-Object -Unique)
        paragraphs = @(Get-Paragraphs $content)
        children = @($children)
    }
}

$settings = [System.Xml.XmlReaderSettings]::new()
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Ignore

$records = @()
$files = Get-ChildItem -LiteralPath $SourceDir -Filter "gskh_*.xml" | Sort-Object Name

foreach ($file in $files) {
    $reader = [System.Xml.XmlReader]::Create($file.FullName, $settings)
    $doc = [xml]::new()
    $doc.PreserveWhitespace = $false
    $doc.Load($reader)
    $reader.Close()

    $level1 = $doc.SelectSingleNode("//level1")
    $era = Get-FirstText $level1 "./front/biblioData/title/mainTitle"
    $eraAlt = Get-FirstText $level1 "./front/biblioData/title/alternative"

    foreach ($level3 in $doc.SelectNodes("//level3")) {
        $parentLevel2 = $level3.ParentNode
        $category = Get-FirstText $parentLevel2 "./front/biblioData/title/mainTitle"
        $categoryAlt = Get-FirstText $parentLevel2 "./front/biblioData/title/alternative"
        $dateNode = $level3.SelectSingleNode("./front/biblioData/date/dateOccured")
        $subjects = @()
        foreach ($subject in $level3.SelectNodes("./front/biblioData/subjectClass")) {
            $subjects += [ordered]@{
                scheme = Get-NodeAttr $subject "scheme"
                code = Get-NodeAttr $subject "code"
                value = Get-Text $subject
            }
        }
        $images = @()
        foreach ($ill in $level3.SelectNodes("./front/illustGroup/illustration")) {
            $imageNode = $ill.SelectSingleNode("./image")
            $images += [ordered]@{
                id = Get-NodeAttr $ill "id"
                caption = Get-FirstText $ill "./caption"
                src = Get-NodeAttr $imageNode "src"
                type = Get-NodeAttr $imageNode "type"
            }
        }
        $sections = @()
        foreach ($section in $level3.SelectNodes("./level4")) {
            $sections += Get-Section $section
        }
        $summaryParts = @()
        foreach ($section in $sections) {
            foreach ($para in $section.paragraphs) {
                if ($para.Length -gt 30) {
                    $summaryParts += $para
                    break
                }
            }
            if ($summaryParts.Count -gt 0) { break }
        }
        $summary = ""
        if ($summaryParts.Count -gt 0) {
            $summary = $summaryParts[0]
            if ($summary.Length -gt 220) { $summary = $summary.Substring(0, 220) + "..." }
        }

        $records += [ordered]@{
            id = Get-NodeAttr $level3 "id"
            file = $file.Name
            era = $era
            eraAlt = $eraAlt
            category = $category
            categoryAlt = $categoryAlt
            title = Get-FirstText $level3 "./front/biblioData/title/mainTitle"
            alternative = Get-FirstText $level3 "./front/biblioData/title/alternative"
            dateText = Get-Text $dateNode
            dateValue = Get-NodeAttr $dateNode "date"
            place = Get-FirstText $level3 "./front/biblioData/publication/place"
            originSize = Get-FirstText $level3 "./front/biblioData/physicalDescription/originSize"
            originForm = Get-FirstText $level3 "./front/biblioData/physicalDescription/originForm"
            originType = Get-FirstText $level3 "./front/biblioData/physicalDescription/originType"
            subjects = @($subjects)
            images = @($images)
            sections = @($sections)
            summary = $summary
        }
    }
}

$eraStats = $records | Group-Object { $_["era"] } | Sort-Object Name | ForEach-Object {
    [ordered]@{ name = $_.Name; count = $_.Count }
}
$categoryStats = $records | Group-Object { $_["category"] } | Sort-Object Name | ForEach-Object {
    [ordered]@{ name = $_.Name; count = $_.Count }
}

$payload = [ordered]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    source = "교육부 국사편찬위원회_한국사데이터베이스 정보_한국고대금석문_20221103"
    total = $records.Count
    stats = [ordered]@{
        eras = @($eraStats)
        categories = @($categoryStats)
        images = ($records | ForEach-Object { $_.images.Count } | Measure-Object -Sum).Sum
    }
    records = @($records)
}

$json = $payload | ConvertTo-Json -Depth 100 -Compress
$js = "window.GSKH_DATA = $json;"
$outDir = Split-Path -Parent $OutFile
if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}
[System.IO.File]::WriteAllText($OutFile, $js, [System.Text.UTF8Encoding]::new($false))
