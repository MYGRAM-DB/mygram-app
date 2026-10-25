(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[data-service-tab]")];
  const panels = [...document.querySelectorAll("[data-service-panel]")];
  const picker = document.getElementById("mygramServiceLanguage");
  if (!tabs.length || !panels.length) return;

  function activate(name, moveFocus = false) {
    const tab = tabs.find(item => item.dataset.serviceTab === name);
    if (!tab) return;
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) item.focus();
    });
    panels.forEach(panel => {
      const active = panel.dataset.servicePanel === name;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    try { sessionStorage.setItem("mygram-services-tab", name); } catch {}
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.serviceTab));
    tab.addEventListener("keydown", event => {
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activate(next.dataset.serviceTab, true);
    });
  });

  if (picker) {
    picker.addEventListener("change", () => {
      const language = picker.value;
      try { localStorage.setItem("mygram-language", language); } catch {}
      if (typeof window.MYGRAM_APPLY_LANGUAGE === "function") window.MYGRAM_APPLY_LANGUAGE(language);
      document.documentElement.lang = language;
      document.documentElement.dir = ["ar", "ur", "fa", "he"].includes(language) ? "rtl" : "ltr";
    });
    window.addEventListener("mygram:languagechange", event => {
      if (event.detail?.language) picker.value = event.detail.language;
    });
  }

  function initialize() {
    let language = "ar";
    try { language = localStorage.getItem("mygram-language") || "ar"; } catch {}
    if (picker && [...picker.options].some(option => option.value === language)) picker.value = language;
    let selected = "stories";
    try {
      const saved = sessionStorage.getItem("mygram-services-tab");
      if (tabs.some(tab => tab.dataset.serviceTab === saved)) selected = saved;
    } catch {}
    activate(selected);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();