const data = window.GSKH_DATA;
const state = {
  query: "",
  era: "all",
  category: "all",
  sort: "title",
  selectedId: null,
  sectionIndex: 0,
  listView: false,
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  eraCount: document.querySelector("#eraCount"),
  imageCount: document.querySelector("#imageCount"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  eraFilter: document.querySelector("#eraFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  records: document.querySelector("#records"),
  detailPanel: document.querySelector("#detailPanel"),
  eraChart: document.querySelector("#eraChart"),
  resetButton: document.querySelector("#resetButton"),
  themeButton: document.querySelector("#themeButton"),
  gridView: document.querySelector("#gridView"),
  listView: document.querySelector("#listView"),
};

const hanjaReadings = window.HANJA_READINGS || {};
const hanjaPattern = /[\u3400-\u9FFF\uF900-\uFAFF]/u;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function annotateText(value = "") {
  return [...String(value)].map((char) => {
    const safe = escapeHtml(char);
    if (!hanjaPattern.test(char)) return safe;
    const readings = hanjaReadings[char];
    if (!readings || readings.length === 0) {
      return `<span class="hanja-char missing-reading" title="독음 사전에 없음">${safe}</span>`;
    }
    return `<span class="hanja-char">${safe}<span class="reading">(${escapeHtml(readings.join("/"))})</span></span>`;
  }).join("");
}

function compactText(parts) {
  return parts.filter(Boolean).join(" ");
}

function searchBlob(record) {
  const sections = record.sections.flatMap((section) => [
    section.title,
    ...section.paragraphs,
    ...section.children.flatMap((child) => [child.title, ...child.paragraphs]),
  ]);
  return compactText([
    record.title,
    record.alternative,
    record.era,
    record.category,
    record.dateText,
    record.place,
    record.originSize,
    record.originForm,
    record.originType,
    record.summary,
    ...record.subjects.map((subject) => subject.value),
    ...sections,
  ]).toLocaleLowerCase("ko-KR");
}

const indexed = data.records.map((record) => ({ ...record, blob: searchBlob(record) }));

function option(label, value, count) {
  const suffix = typeof count === "number" ? ` (${count})` : "";
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}${suffix}</option>`;
}

function initFilters() {
  els.totalCount.textContent = data.total.toLocaleString("ko-KR");
  els.eraCount.textContent = data.stats.eras.length.toLocaleString("ko-KR");
  els.imageCount.textContent = data.stats.images.toLocaleString("ko-KR");

  els.eraFilter.innerHTML = option("전체", "all") + data.stats.eras.map((item) => option(item.name, item.name, item.count)).join("");
  els.categoryFilter.innerHTML = option("전체", "all") + data.stats.categories.map((item) => option(item.name, item.name, item.count)).join("");
  els.eraFilter.value = "all";
  els.categoryFilter.value = "all";
  els.sortSelect.value = "title";
  els.searchInput.value = "";
}

function renderChart() {
  const max = Math.max(...data.stats.eras.map((item) => item.count));
  els.eraChart.innerHTML = data.stats.eras.map((item) => {
    const width = Math.max(4, Math.round((item.count / max) * 100));
    return `
      <button class="bar-row" type="button" data-era="${escapeHtml(item.name)}">
        <span>${escapeHtml(item.name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
        <strong>${item.count}</strong>
      </button>
    `;
  }).join("");

  els.eraChart.querySelectorAll(".bar-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.era = button.dataset.era;
      els.eraFilter.value = state.era;
      render();
    });
  });
}

function filteredRecords() {
  const query = state.query.trim().toLocaleLowerCase("ko-KR");
  const result = indexed.filter((record) => {
    const eraOk = state.era === "all" || record.era === state.era;
    const categoryOk = state.category === "all" || record.category === state.category;
    const queryOk = !query || record.blob.includes(query);
    return eraOk && categoryOk && queryOk;
  });

  result.sort((a, b) => {
    if (state.sort === "era") return `${a.era}${a.title}`.localeCompare(`${b.era}${b.title}`, "ko-KR");
    if (state.sort === "date") return (a.dateValue || "9999").localeCompare(b.dateValue || "9999");
    if (state.sort === "images") return b.images.length - a.images.length || a.title.localeCompare(b.title, "ko-KR");
    return a.title.localeCompare(b.title, "ko-KR");
  });
  return result;
}

function highlight(text) {
  return annotateText(text || "");
}

function renderRecords(records) {
  els.records.classList.toggle("list", state.listView);
  els.resultCount.textContent = `${records.length.toLocaleString("ko-KR")}건`;

  if (records.length === 0) {
    els.records.innerHTML = `<div class="record-card"><h3>검색 결과 없음</h3><p class="summary">검색어나 필터를 조정해 보세요.</p></div>`;
    return;
  }

  els.records.innerHTML = records.map((record) => `
    <article class="record-card ${record.id === state.selectedId ? "active" : ""}" tabindex="0" data-id="${escapeHtml(record.id)}">
      <h3>${highlight(record.title)}</h3>
      <div class="alt">${highlight(record.alternative)}</div>
      <div class="chips">
        <span class="chip">${escapeHtml(record.era)}</span>
        <span class="chip">${escapeHtml(record.category)}</span>
        ${record.images.length ? `<span class="chip">이미지 ${record.images.length}</span>` : ""}
      </div>
      <p class="summary">${highlight(record.summary || record.place || "본문 절을 상세 보기에서 확인할 수 있습니다.")}</p>
    </article>
  `).join("");

  els.records.querySelectorAll(".record-card[data-id]").forEach((card) => {
    const select = () => {
      state.selectedId = card.dataset.id;
      state.sectionIndex = 0;
      render();
      if (window.innerWidth < 1180) els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    card.addEventListener("click", select);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") select();
    });
  });
}

function metadataItem(label, value) {
  if (!value) return "";
  return `<div><dt>${escapeHtml(label)}</dt><dd>${highlight(value)}</dd></div>`;
}

function renderSection(section) {
  const authorText = section.authors.length ? `집필: ${section.authors.join(", ")}` : "";
  const kindText = section.kind ? `분류: ${section.kind}` : "";
  const meta = [kindText, authorText].filter(Boolean).join(" · ");
  const paragraphs = section.paragraphs.slice(0, 80).map((para) => `<p>${highlight(para)}</p>`).join("");
  const children = section.children.map((child) => `
    <div class="child-section">
      <h3>${escapeHtml(child.title || "하위 절")}</h3>
      ${child.paragraphs.slice(0, 40).map((para) => `<p>${highlight(para)}</p>`).join("")}
    </div>
  `).join("");
  return `
    <div class="section-body">
      ${meta ? `<p class="section-meta">${escapeHtml(meta)}</p>` : ""}
      ${paragraphs || "<p>이 절에는 표시할 본문이 없습니다.</p>"}
      ${children}
    </div>
  `;
}

function renderDetail() {
  const record = indexed.find((item) => item.id === state.selectedId) || indexed[0];
  if (!state.selectedId && record) state.selectedId = record.id;
  if (!record) return;

  const subjects = record.subjects.map((subject) => `${subject.scheme}: ${subject.value}`).join(" / ");
  const section = record.sections[state.sectionIndex] || record.sections[0];
  const tabs = record.sections.map((item, index) => `
    <button type="button" class="${index === state.sectionIndex ? "active" : ""}" data-section="${index}">
      ${escapeHtml(item.title || item.kind || `절 ${index + 1}`)}
    </button>
  `).join("");
  const images = record.images.length
    ? `<div class="image-list">${record.images.slice(0, 30).map((image) => `
        <div class="image-item">
          <strong>${escapeHtml(image.caption || image.id)}</strong><br>
          <span>${escapeHtml(image.src)}.${escapeHtml(image.type || "jpg")}</span>
        </div>
      `).join("")}</div>`
    : `<div class="image-list"><div class="image-item">이 자료에는 이미지 메타데이터가 없습니다.</div></div>`;

  els.detailPanel.innerHTML = `
    <div class="detail-content">
      <div class="detail-title">
        <h2>${highlight(record.title)}</h2>
        <p class="summary">${highlight(record.alternative)}</p>
      </div>
      <dl class="metadata">
        ${metadataItem("시대", record.era)}
        ${metadataItem("유형", record.category)}
        ${metadataItem("연대", record.dateText)}
        ${metadataItem("소재지", record.place)}
        ${metadataItem("크기", record.originSize)}
        ${metadataItem("서체/형태", [record.originForm, record.originType].filter(Boolean).join(" / "))}
        ${metadataItem("주제", subjects)}
        ${metadataItem("원본 파일", record.file)}
      </dl>
      <div class="tabs">${tabs}</div>
      ${section ? renderSection(section) : "<p>본문 절이 없습니다.</p>"}
      ${images}
    </div>
  `;

  els.detailPanel.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.sectionIndex = Number(button.dataset.section);
      renderDetail();
    });
  });
}

function render() {
  const records = filteredRecords();
  if (records.length && !records.some((record) => record.id === state.selectedId)) {
    state.selectedId = records[0].id;
    state.sectionIndex = 0;
  }
  renderRecords(records);
  renderDetail();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  els.eraFilter.addEventListener("change", (event) => {
    state.era = event.target.value;
    render();
  });
  els.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  els.resetButton.addEventListener("click", () => {
    state.query = "";
    state.era = "all";
    state.category = "all";
    state.sort = "title";
    state.sectionIndex = 0;
    els.searchInput.value = "";
    els.eraFilter.value = "all";
    els.categoryFilter.value = "all";
    els.sortSelect.value = "title";
    render();
  });
  els.themeButton.addEventListener("click", () => document.body.classList.toggle("dark"));
  els.gridView.addEventListener("click", () => {
    state.listView = false;
    els.gridView.classList.add("active");
    els.listView.classList.remove("active");
    renderRecords(filteredRecords());
  });
  els.listView.addEventListener("click", () => {
    state.listView = true;
    els.listView.classList.add("active");
    els.gridView.classList.remove("active");
    renderRecords(filteredRecords());
  });
}

initFilters();
renderChart();
bindEvents();
render();
