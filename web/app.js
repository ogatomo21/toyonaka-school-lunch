const sourceSelect = document.querySelector("#source-select");
const monthSelect = document.querySelector("#month-select");
const todayButton = document.querySelector("#today-button");
const sourceDescription = document.querySelector("#source-description");
const sourceLink = document.querySelector("#source-link");
const menuPeriod = document.querySelector("#menu-period");
const statusElement = document.querySelector("#status");
const menuList = document.querySelector("#menu-list");
const DEFAULT_SOURCE_ID = "middle-a";
const SOURCE_STORAGE_KEY = "lunch-source";

const state = {
  sources: [],
  selectedSource: null
};

const readSavedSource = () => {
  try {
    return localStorage.getItem(SOURCE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveSource = (sourceId) => {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, sourceId);
  } catch {
    // 保存領域が利用できない環境でも、献立表示は継続する。
  }
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? "データを取得できませんでした");
  }
  return body;
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const currentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatMonth = (value) => {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
};

const setStatus = (message, isError = false) => {
  statusElement.textContent = message;
  statusElement.classList.toggle("text-danger", isError);
  statusElement.classList.remove("hidden");
  menuList.replaceChildren();
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const renderDay = (day) => {
  const card = createElement("article", "menu-card");
  if (day.date === currentDate()) card.classList.add("menu-card-today");

  const [year, month, date] = day.date.split("-");
  const headingRow = createElement("div", "mb-4 flex items-start justify-between gap-3");
  const heading = createElement("h3", "text-lg font-bold", `${Number(month)}月${Number(date)}日（${day.weekday}）`);
  headingRow.append(heading);
  if (day.date === currentDate()) {
    headingRow.append(createElement("span", "rounded-full bg-primary px-3 py-1 text-xs font-bold text-white dark:bg-tertiary dark:text-secondary", "今日"));
  }
  card.append(headingRow);

  if (day.tags?.length) {
    const tags = createElement("div", "mb-4 flex flex-wrap gap-2");
    day.tags.forEach((tag) => tags.append(createElement("span", "tag-chip", tag)));
    card.append(tags);
  }

  const menu = createElement("ul", "space-y-2 text-[0.95rem]");
  [...day.menu, ...(day.beverages ?? [])].forEach((item) => {
    menu.append(createElement("li", "menu-item", item));
  });
  card.append(menu);

  card.dataset.year = year;
  return card;
};

const renderLunches = (lunchDocument) => {
  statusElement.classList.add("hidden");
  menuPeriod.textContent = `${formatMonth(`${lunchDocument.year}-${String(lunchDocument.month).padStart(2, "0")}`)}・${lunchDocument.days.length}日分`;
  const fragment = document.createDocumentFragment();
  lunchDocument.days.forEach((day) => fragment.append(renderDay(day)));
  menuList.replaceChildren(fragment);
};

const loadLunches = async () => {
  const sourceId = sourceSelect.value;
  const month = monthSelect.value;
  if (!sourceId || !month) return;
  setStatus("献立を読み込んでいます。");
  try {
    const lunchDocument = await fetchJson(`/api/lunches?source=${encodeURIComponent(sourceId)}&month=${encodeURIComponent(month)}`);
    renderLunches(lunchDocument);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "献立を取得できませんでした。", true);
  }
};

const selectSource = (sourceId, preferredMonth) => {
  const source = state.sources.find((item) => item.id === sourceId)
    ?? state.sources.find((item) => item.id === DEFAULT_SOURCE_ID)
    ?? state.sources[0];
  if (!source) return;
  state.selectedSource = source;
  sourceSelect.value = source.id;
  saveSource(source.id);
  monthSelect.replaceChildren();
  [...source.months].reverse().forEach((month) => {
    const option = createElement("option", "", formatMonth(month));
    option.value = month;
    monthSelect.append(option);
  });
  const targetMonth = source.months.includes(preferredMonth)
    ? preferredMonth
    : source.months[source.months.length - 1];
  monthSelect.value = targetMonth;
  sourceDescription.textContent = `対象校：${source.schools.join("・")}`;
  sourceLink.href = source.source_url;
  sourceLink.classList.remove("hidden");
  void loadLunches();
};

const initialize = async () => {
  try {
    const index = await fetchJson("/api/sources");
    state.sources = index.sources;
    const groups = [
      ["elementary_school", "小学校・義務教育学校（前期課程）"],
      ["middle_school", "中学校・義務教育学校（後期課程）"]
    ];
    groups.forEach(([level, label]) => {
      const sources = state.sources.filter((source) => source.level === level);
      if (!sources.length) return;
      const group = document.createElement("optgroup");
      group.label = label;
      sources.forEach((source) => {
        const option = createElement("option", "", source.name);
        option.value = source.id;
        group.append(option);
      });
      sourceSelect.append(group);
    });

    const savedSource = readSavedSource() ?? DEFAULT_SOURCE_ID;
    selectSource(savedSource, currentMonth());
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "取得元を読み込めませんでした。", true);
  }
};

sourceSelect.addEventListener("change", () => selectSource(sourceSelect.value, currentMonth()));
monthSelect.addEventListener("change", () => void loadLunches());
todayButton.addEventListener("click", () => selectSource(sourceSelect.value, currentMonth()));

void initialize();
