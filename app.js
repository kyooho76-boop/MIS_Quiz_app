const MULTIPLE_DATA = Array.isArray(window.QUIZ_DATA) ? window.QUIZ_DATA : [];
const SHORT_DATA = Array.isArray(window.SHORT_DATA) ? window.SHORT_DATA : [];
const OPTION_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const DONT_KNOW_OPTION = "잘 모르겠음";
const SAVED_WRONG_STORAGE_KEY = "mis-quiz-saved-wrongs-v1";

function loadSavedWrongNotes() {
  try {
    const raw = window.localStorage.getItem(SAVED_WRONG_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item.key === "string");
  } catch (error) {
    return [];
  }
}

const state = {
  mode: "multiple",
  filter: "all",
  shuffle: true,
  queue: [],
  index: 0,
  answered: false,
  selectedIndex: null,
  results: [],
  shortRevealed: false,
  reviewSet: null,
  reviewLabel: null,
  savedWrongNotes: loadSavedWrongNotes(),
  savedNotesOpen: false,
};

const elements = {
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  sourceFilter: document.getElementById("sourceFilter"),
  shuffleToggle: document.getElementById("shuffleToggle"),
  restartButton: document.getElementById("restartButton"),
  modeCopy: document.getElementById("modeCopy"),
  sourceBadge: document.getElementById("sourceBadge"),
  sectionBadge: document.getElementById("sectionBadge"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  questionView: document.getElementById("questionView"),
  questionNumber: document.getElementById("questionNumber"),
  questionText: document.getElementById("questionText"),
  options: document.getElementById("options"),
  feedback: document.getElementById("feedback"),
  shortPanel: document.getElementById("shortPanel"),
  shortInput: document.getElementById("shortInput"),
  shortAnswer: document.getElementById("shortAnswer"),
  revealButton: document.getElementById("revealButton"),
  nextButton: document.getElementById("nextButton"),
  summaryView: document.getElementById("summaryView"),
  setCount: document.getElementById("setCount"),
  setHint: document.getElementById("setHint"),
  correctCount: document.getElementById("correctCount"),
  accuracyText: document.getElementById("accuracyText"),
  multipleTotal: document.getElementById("multipleTotal"),
  shortTotal: document.getElementById("shortTotal"),
  wrongCount: document.getElementById("wrongCount"),
  savedWrongCount: document.getElementById("savedWrongCount"),
  showNotesButton: document.getElementById("showNotesButton"),
  savedWrongQuizButton: document.getElementById("savedWrongQuizButton"),
  clearNotesButton: document.getElementById("clearNotesButton"),
  savedNotesPanel: document.getElementById("savedNotesPanel"),
};

function persistSavedWrongNotes() {
  try {
    window.localStorage.setItem(SAVED_WRONG_STORAGE_KEY, JSON.stringify(state.savedWrongNotes));
  } catch (error) {
    console.warn("오답노트를 저장하지 못했습니다.", error);
  }
}

function sortSavedWrongNotes(notes) {
  return [...notes].sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function formatSavedAt(timestamp) {
  if (!timestamp) {
    return "저장 시각 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function questionKey(question) {
  return [question.type || state.mode, question.source, question.id || question.promptFull].join("::");
}

function getDisplayedOptions(question) {
  return [...question.options, DONT_KNOW_OPTION];
}

function saveWrongNote(question, selectedIndex) {
  const key = questionKey(question);
  const note = {
    key,
    source: question.source,
    section: question.section,
    id: question.id,
    prompt: question.prompt,
    selectedIndex,
    answerIndex: question.answerIndex,
    selectedAnswer: getDisplayedOptions(question)[selectedIndex] || question.options[selectedIndex],
    correctAnswer: question.options[question.answerIndex],
    updatedAt: new Date().toISOString(),
  };

  state.savedWrongNotes = sortSavedWrongNotes([
    note,
    ...state.savedWrongNotes.filter((item) => item.key !== key),
  ]);
  persistSavedWrongNotes();
}

function removeSavedWrongNote(key) {
  state.savedWrongNotes = state.savedWrongNotes.filter((item) => item.key !== key);
  persistSavedWrongNotes();
  updateSidebar();
}

function clearSavedWrongNotes() {
  state.savedWrongNotes = [];
  persistSavedWrongNotes();
  updateSidebar();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sourceMatches(question) {
  if (state.filter === "all") {
    return true;
  }
  return question.source.includes(state.filter);
}

function getBasePool() {
  const source = state.mode === "multiple" ? MULTIPLE_DATA : SHORT_DATA;
  let pool = source.filter(sourceMatches);

  if (state.reviewSet && state.mode === "multiple") {
    pool = pool.filter((question) => state.reviewSet.has(questionKey(question)));
  }

  return state.shuffle ? shuffle(pool) : [...pool];
}

function getWrongResults() {
  return state.results.filter((result) => result.correct === false);
}

function syncModeButtons() {
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
}

function renderSavedNotesPanel() {
  elements.showNotesButton.textContent = state.savedNotesOpen ? "오답노트 닫기" : "오답노트 보기";
  elements.savedWrongQuizButton.disabled = state.savedWrongNotes.length === 0;
  elements.clearNotesButton.disabled = state.savedWrongNotes.length === 0;

  if (!state.savedNotesOpen) {
    elements.savedNotesPanel.hidden = true;
    elements.savedNotesPanel.replaceChildren();
    return;
  }

  const header = document.createElement("div");
  header.className = "saved-notes-header";

  const headerText = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "saved-notes-title";
  title.textContent = "저장된 오답노트";

  const copy = document.createElement("p");
  copy.className = "saved-notes-copy";
  copy.textContent = state.savedWrongNotes.length
    ? `틀렸던 문제 ${state.savedWrongNotes.length}개를 저장해뒀어요.`
    : "아직 저장된 오답이 없어요.";

  headerText.append(title, copy);
  header.append(headerText);

  elements.savedNotesPanel.hidden = false;

  if (state.savedWrongNotes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "note-empty";
    empty.textContent = "틀린 문제가 생기면 여기 차곡차곡 쌓입니다.";
    elements.savedNotesPanel.replaceChildren(header, empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "saved-notes-list";

  state.savedWrongNotes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const meta = document.createElement("div");
    meta.className = "note-meta";

    const sourceBadge = document.createElement("span");
    sourceBadge.className = "badge";
    sourceBadge.textContent = note.source;

    const sectionBadge = document.createElement("span");
    sectionBadge.className = "badge badge-muted";
    sectionBadge.textContent = note.section || "섹션";

    const timeBadge = document.createElement("span");
    timeBadge.className = "badge badge-muted";
    timeBadge.textContent = formatSavedAt(note.updatedAt);

    meta.append(sourceBadge, sectionBadge, timeBadge);

    const prompt = document.createElement("p");
    prompt.className = "note-prompt";
    prompt.textContent = `${note.id || ""} ${note.prompt}`.trim();

    const answerGrid = document.createElement("div");
    answerGrid.className = "note-answer-grid";

    const wrongRow = document.createElement("div");
    wrongRow.className = "note-answer-row wrong";
    const wrongLabel = document.createElement("strong");
    wrongLabel.textContent = "내가 고른 답";
    const wrongBody = document.createElement("div");
    wrongBody.textContent = note.selectedAnswer;
    wrongRow.append(wrongLabel, wrongBody);

    const correctRow = document.createElement("div");
    correctRow.className = "note-answer-row correct";
    const correctLabel = document.createElement("strong");
    correctLabel.textContent = "정답";
    const correctBody = document.createElement("div");
    correctBody.textContent = note.correctAnswer;
    correctRow.append(correctLabel, correctBody);

    answerGrid.append(wrongRow, correctRow);

    const actions = document.createElement("div");
    actions.className = "note-card-actions";

    const solveButton = document.createElement("button");
    solveButton.type = "button";
    solveButton.className = "accent-button";
    solveButton.textContent = "이 문제 다시 풀기";
    solveButton.addEventListener("click", () => {
      startReviewRound(new Set([note.key]), "선택한 오답 한 문제를 다시 풀고 있어요.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ghost-button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => removeSavedWrongNote(note.key));

    actions.append(solveButton, deleteButton);
    card.append(meta, prompt, answerGrid, actions);
    list.append(card);
  });

  elements.savedNotesPanel.replaceChildren(header, list);
}

function updateSidebar() {
  const answeredResults = state.results.filter((result) => typeof result.correct === "boolean");
  const correctResults = answeredResults.filter((result) => result.correct).length;
  const accuracy = answeredResults.length ? Math.round((correctResults / answeredResults.length) * 100) : 0;

  elements.multipleTotal.textContent = String(MULTIPLE_DATA.length);
  elements.shortTotal.textContent = String(SHORT_DATA.length);
  elements.wrongCount.textContent = String(getWrongResults().length);
  elements.savedWrongCount.textContent = String(state.savedWrongNotes.length);
  elements.correctCount.textContent = String(correctResults);
  elements.accuracyText.textContent = `${accuracy}%`;
  elements.setCount.textContent = `${state.queue.length}문제`;
  elements.setHint.textContent = state.reviewSet
    ? "고른 문제만 다시 푸는 중이에요."
    : state.mode === "multiple"
      ? "숫자 키 1-5로 답을 고를 수 있어요."
      : "정답 보기로 빠르게 돌려보세요.";
  renderSavedNotesPanel();
}

function updateTopCopy() {
  if (state.mode === "multiple" && state.reviewSet) {
    elements.modeCopy.textContent = state.reviewLabel || `고른 ${state.queue.length}문제를 다시 풀고 있어요.`;
  } else if (state.mode === "multiple") {
    elements.modeCopy.textContent =
      state.filter === "all"
        ? "객관식 186문제를 바로 풀 수 있어요."
        : `${state.filter} 객관식만 골라서 풀 수 있어요.`;
  } else {
    elements.modeCopy.textContent = "단답은 먼저 떠올리고 정답을 확인하는 카드로 돌릴 수 있어요.";
  }
}

function updateProgress() {
  const total = state.queue.length;
  const current = total === 0 ? 0 : Math.min(state.index + 1, total);
  const percent = total === 0 ? 0 : Math.min((current / total) * 100, 100);

  elements.progressText.textContent = total === 0 ? "0 / 0" : `${current} / ${total}`;
  elements.progressFill.style.width = `${percent}%`;
}

function getCurrentReviewOptions() {
  if (!state.reviewSet) {
    return {};
  }

  return {
    reviewSet: new Set(state.reviewSet),
    reviewLabel: state.reviewLabel,
  };
}

function resetRound({ reviewSet = null, reviewLabel = null } = {}) {
  state.index = 0;
  state.answered = false;
  state.selectedIndex = null;
  state.shortRevealed = false;
  state.reviewSet = reviewSet;
  state.reviewLabel = reviewLabel;
  state.queue = getBasePool();
  state.results = [];
  elements.shortInput.value = "";
  updateSidebar();
  updateTopCopy();
  render();
}

function startReviewRound(reviewSet, reviewLabel) {
  state.mode = "multiple";
  state.filter = "all";
  state.savedNotesOpen = false;
  elements.sourceFilter.value = "all";
  syncModeButtons();
  resetRound({ reviewSet, reviewLabel });
}

function renderEmptyState(message) {
  elements.summaryView.hidden = true;
  elements.questionView.hidden = false;
  elements.questionNumber.textContent = "";
  elements.questionText.textContent = "지금은 풀 문제가 없어요.";
  elements.options.hidden = false;
  elements.options.innerHTML = "";
  elements.shortPanel.hidden = true;
  elements.feedback.hidden = true;
  elements.nextButton.hidden = true;
  elements.revealButton.hidden = true;
  elements.sectionBadge.textContent = "범위를 바꿔보세요";
  elements.sourceBadge.textContent = state.filter === "all" ? "전체" : state.filter;

  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  elements.options.append(empty);
  updateProgress();
}

function renderSummary() {
  const answeredResults = state.results.filter((result) => typeof result.correct === "boolean");
  const correctResults = answeredResults.filter((result) => result.correct).length;
  const accuracy = answeredResults.length ? Math.round((correctResults / answeredResults.length) * 100) : 0;
  const wrongCount = getWrongResults().length;

  elements.questionView.hidden = true;
  elements.summaryView.hidden = false;
  elements.feedback.hidden = true;
  elements.nextButton.hidden = true;
  elements.revealButton.hidden = true;

  const wrapper = document.createElement("div");
  const title = document.createElement("h3");
  const body = document.createElement("p");
  const actions = document.createElement("div");
  actions.className = "summary-actions";

  if (state.mode === "multiple") {
    title.textContent = "이번 세트 끝";
    body.textContent = `정답 ${correctResults}개, 오답 ${wrongCount}개, 정확도 ${accuracy}%`;
  } else {
    title.textContent = "단답 카드 끝";
    body.textContent = `총 ${state.queue.length}문제를 한 바퀴 돌렸어요.`;
  }

  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "accent-button";
  restart.textContent = "다시 풀기";
  restart.addEventListener("click", () => resetRound(getCurrentReviewOptions()));
  actions.append(restart);

  if (state.mode === "multiple" && wrongCount > 0) {
    const retryWrong = document.createElement("button");
    retryWrong.type = "button";
    retryWrong.className = "ghost-button";
    retryWrong.textContent = "오답만 다시";
    retryWrong.addEventListener("click", () =>
      startReviewRound(
        new Set(getWrongResults().map((result) => result.key)),
        "이번 세트 오답만 다시 풀고 있어요.",
      ),
    );
    actions.append(retryWrong);
  }

  wrapper.append(title, body, actions);
  elements.summaryView.replaceChildren(wrapper);
  updateProgress();
  updateSidebar();
}

function setFeedback({ tone, title, detail }) {
  const heading = document.createElement("span");
  heading.className = "feedback-title";
  heading.textContent = title;

  const body = document.createElement("div");
  body.textContent = detail;

  elements.feedback.hidden = false;
  elements.feedback.className = `feedback ${tone}`;
  elements.feedback.replaceChildren(heading, body);
}

function clearFeedback() {
  elements.feedback.hidden = true;
  elements.feedback.className = "feedback";
  elements.feedback.textContent = "";
}

function createOptionButton(optionText, index, question) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option-button";

  const indexBadge = document.createElement("span");
  indexBadge.className = "option-index";
  indexBadge.textContent = OPTION_LABELS[index] || String(index + 1);

  const body = document.createElement("span");
  body.className = "option-body";
  body.textContent = optionText;

  button.append(indexBadge, body);

  if (state.answered) {
    button.disabled = true;
    if (index === question.answerIndex) {
      button.classList.add("is-correct");
    } else if (index === state.selectedIndex && index !== question.answerIndex) {
      button.classList.add("is-wrong");
    } else {
      button.classList.add("is-muted");
    }
  } else {
    button.addEventListener("click", () => answerMultiple(index));
  }

  return button;
}

function renderMultiple(question) {
  elements.shortPanel.hidden = true;
  elements.revealButton.hidden = true;
  elements.options.hidden = false;
  const displayedOptions = getDisplayedOptions(question);
  elements.options.replaceChildren(...displayedOptions.map((optionText, index) => createOptionButton(optionText, index, question)));
  elements.nextButton.hidden = !state.answered;
}

function renderShort(question) {
  elements.options.hidden = true;
  elements.options.innerHTML = "";
  elements.shortPanel.hidden = false;
  elements.shortAnswer.hidden = !state.shortRevealed;
  elements.shortAnswer.textContent = question.answer;
  elements.revealButton.hidden = state.shortRevealed;
  elements.nextButton.hidden = !state.shortRevealed;
}

function renderQuestion() {
  const question = state.queue[state.index];

  elements.questionView.hidden = false;
  elements.summaryView.hidden = true;
  elements.sectionBadge.textContent = question.section || "섹션 없음";
  elements.sourceBadge.textContent = question.source;
  elements.questionNumber.textContent = question.id || `문제 ${state.index + 1}`;
  elements.questionText.textContent = question.prompt;
  elements.shortInput.value = "";

  if (state.mode === "multiple") {
    renderMultiple(question);
  } else {
    renderShort(question);
  }

  updateProgress();
  updateSidebar();
}

function render() {
  updateTopCopy();

  if (state.queue.length === 0) {
    const message =
      state.mode === "multiple"
        ? "이 범위에는 객관식이 없어요. 범위를 다시 골라보세요."
        : "이 범위에는 단답 카드가 없어요. 전체나 기출로 바꿔보세요.";
    renderEmptyState(message);
    updateSidebar();
    return;
  }

  if (state.index >= state.queue.length) {
    renderSummary();
    return;
  }

  clearFeedback();
  renderQuestion();
}

function recordResult(question, correct, extra = {}) {
  state.results.push({
    key: questionKey(question),
    questionId: question.id,
    correct,
    ...extra,
  });
}

function answerMultiple(selectedIndex) {
  if (state.answered) {
    return;
  }

  const question = state.queue[state.index];
  const correct = selectedIndex === question.answerIndex;
  const choseDontKnow = selectedIndex === question.options.length;
  state.answered = true;
  state.selectedIndex = selectedIndex;

  recordResult(question, correct, {
    selectedIndex,
    answerIndex: question.answerIndex,
  });

  const correctAnswer = question.options[question.answerIndex];
  if (!correct) {
    saveWrongNote(question, selectedIndex);
  }
  setFeedback({
    tone: correct ? "success" : "error",
    title: correct ? "O" : "X",
    detail: correct
      ? "정답이에요. 바로 다음 문제로 넘어가면 됩니다."
      : choseDontKnow
        ? `아리까리한 문제로 오답노트에 저장했어요. 정답은 ${correctAnswer}.`
        : `정답은 ${correctAnswer}. 오답노트에 저장했어요.`,
  });

  renderQuestion();
}

function revealShortAnswer() {
  if (state.shortRevealed) {
    return;
  }

  const question = state.queue[state.index];
  state.shortRevealed = true;
  recordResult(question, null, { revealed: true });
  setFeedback({
    tone: "success",
    title: "정답 확인",
    detail: question.answer,
  });
  renderQuestion();
}

function nextQuestion() {
  if (state.mode === "multiple" && !state.answered) {
    return;
  }
  if (state.mode === "short" && !state.shortRevealed) {
    return;
  }

  state.index += 1;
  state.answered = false;
  state.selectedIndex = null;
  state.shortRevealed = false;
  elements.shortInput.value = "";
  render();
}

function activateMode(mode) {
  state.mode = mode;
  state.results = [];
  state.reviewSet = null;
  state.reviewLabel = null;
  syncModeButtons();
  resetRound();
}

function bindEvents() {
  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => activateMode(button.dataset.mode));
  });

  elements.sourceFilter.addEventListener("change", (event) => {
    state.filter = event.target.value;
    resetRound();
  });

  elements.shuffleToggle.addEventListener("change", (event) => {
    state.shuffle = event.target.checked;
    resetRound();
  });

  elements.restartButton.addEventListener("click", () => resetRound(getCurrentReviewOptions()));
  elements.revealButton.addEventListener("click", revealShortAnswer);
  elements.nextButton.addEventListener("click", nextQuestion);
  elements.showNotesButton.addEventListener("click", () => {
    state.savedNotesOpen = !state.savedNotesOpen;
    renderSavedNotesPanel();
  });
  elements.savedWrongQuizButton.addEventListener("click", () => {
    if (!state.savedWrongNotes.length) {
      return;
    }
    startReviewRound(
      new Set(state.savedWrongNotes.map((note) => note.key)),
      "저장된 오답노트만 다시 풀고 있어요.",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  elements.clearNotesButton.addEventListener("click", () => {
    if (!state.savedWrongNotes.length) {
      return;
    }
    if (window.confirm("저장된 오답노트를 전부 비울까요?")) {
      clearSavedWrongNotes();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (state.mode === "multiple" && !state.answered) {
      const parsed = Number(event.key);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        const question = state.queue[state.index];
        const optionIndex = parsed - 1;
        const optionCount = question ? getDisplayedOptions(question).length : 0;
        if (question && optionIndex < optionCount) {
          answerMultiple(optionIndex);
        }
      }
    }

    if (event.key === "Enter") {
      if (state.mode === "multiple" && state.answered) {
        nextQuestion();
      } else if (state.mode === "short") {
        if (state.shortRevealed) {
          nextQuestion();
        } else {
          revealShortAnswer();
        }
      }
    }
  });
}

function init() {
  state.filter = elements.sourceFilter.value;
  state.shuffle = elements.shuffleToggle.checked;
  bindEvents();
  syncModeButtons();
  resetRound();
}

init();
