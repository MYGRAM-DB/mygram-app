(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[data-people-tab]")];
  const panels = [...document.querySelectorAll("[data-people-panel]")];
  if (!tabs.length || !panels.length) return;

  function activate(name, focus = false, updateUrl = true) {
    const tab = tabs.find(item => item.dataset.peopleTab === name);
    if (!tab) return;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      if (selected && focus) item.focus();
    }
    for (const panel of panels) {
      const selected = panel.dataset.peoplePanel === name;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    }
    try { sessionStorage.setItem("mygram-people-tab", name); } catch {}
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (name === "suggestions") url.searchParams.delete("tab");
      else url.searchParams.set("tab", name);
      history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.peopleTab));
    tab.addEventListener("keydown", event => {
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activate(next.dataset.peopleTab, true);
    });
  });

  function initialize() {
    const params = new URLSearchParams(window.location.search);
    let selected = params.get("tab");
    if (!tabs.some(tab => tab.dataset.peopleTab === selected)) {
      try { selected = sessionStorage.getItem("mygram-people-tab"); } catch {}
    }
    if (!tabs.some(tab => tab.dataset.peopleTab === selected)) selected = "suggestions";
    activate(selected, false, false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();