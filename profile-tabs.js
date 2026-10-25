(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[data-profile-tab]")];
  const panels = [...document.querySelectorAll("[data-profile-panel]")];
  const preferredLanguage = document.getElementById("preferredLanguage");
  if (!tabs.length || !panels.length) return;

  function activate(name, focus = false) {
    const selectedTab = tabs.find(tab => tab.dataset.profileTab === name);
    if (!selectedTab) return;
    tabs.forEach(tab => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(panel => {
      const selected = panel.dataset.profilePanel === name;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });
    try { sessionStorage.setItem("mygram-profile-tab", name); } catch {}
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.profileTab));
    tab.addEventListener("keydown", event => {
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activate(next.dataset.profileTab, true);
    });
  });

  if (preferredLanguage) {
    preferredLanguage.addEventListener("change", () => {
      const language = preferredLanguage.value;
      try { localStorage.setItem("mygram-language", language); } catch {}
      if (typeof window.MYGRAM_APPLY_LANGUAGE === "function") window.MYGRAM_APPLY_LANGUAGE(language);
      document.documentElement.lang = language;
      document.documentElement.dir = ["ar", "ur", "fa", "he"].includes(language) ? "rtl" : "ltr";
    });
    window.addEventListener("mygram:languagechange", event => {
      if (event.detail && event.detail.language && [...preferredLanguage.options].some(option => option.value === event.detail.language)) {
        preferredLanguage.value = event.detail.language;
      }
    });
  }

  function initialize() {
    let selected = "basics";
    try {
      const saved = sessionStorage.getItem("mygram-profile-tab");
      if (tabs.some(tab => tab.dataset.profileTab === saved)) selected = saved;
    } catch {}
    activate(selected);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();