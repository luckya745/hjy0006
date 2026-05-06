from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).parent


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def build_embedded_app() -> str:
    html = read_text("index.html")
    css = read_text("styles.css")
    data = read_text("data/gskh-data.js")
    readings = read_text("data/hanja-readings.js")
    app = read_text("app.js")

    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>{css}</style>")
    html = html.replace('<script src="data/gskh-data.js"></script>', f"<script>{data}</script>")
    html = html.replace('<script src="data/hanja-readings.js"></script>', f"<script>{readings}</script>")
    html = html.replace('<script src="app.js"></script>', f"<script>{app}</script>")
    return html


st.set_page_config(
    page_title="한국고대금석문 탐색기",
    page_icon="📜",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      .block-container {
        padding: 0;
        max-width: none;
      }
      header[data-testid="stHeader"] {
        display: none;
      }
      iframe {
        display: block;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

components.html(build_embedded_app(), height=980, scrolling=True)
