let problems = [];
let current = null;
let correctCount = 0;
let totalCount = 0;
let shuffledIndices = [];

function loadProblems() {
  console.log("getting problem_sources_mock_test.json")
  $.getJSON("problem_sources_mock_test.json", function(sources) {
    console.log("got problem_sources_mock_test.json")
    let pending = sources.length;
    sources.forEach(src => {
      $.getJSON(src, function(data) {
        console.log(`got ${src}.json`)
        problems.push(...data.problems);
      }).always(() => {
        if (--pending === 0) {
          reshuffleIndices()
          showNextProblem();
        }
      });
    });
  });

  // 從 cookie 載入統計資料
  const cookie = document.cookie.split("; ").find(r => r.startsWith("quiz_stats="));
  if (cookie) {
    try {
      const stats = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
      correctCount = stats.correct || 0;
      totalCount = stats.total || 0;
    } catch(e) {}
  }
}

function reshuffleIndices() {
  shuffledIndices = Array.from(problems.keys());
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }
}

function showNextProblem() {
  $(".option").removeClass("correct wrong");

  if (shuffledIndices.length === 0) reshuffleIndices();
  const nextIndex = shuffledIndices.pop();
  current = problems[nextIndex];
  if (!current) return;

  $("#problem").text(current.question);
  $("#A").text("A. " + current.options.A);
  $("#B").text("B. " + current.options.B);
  $("#C").text("C. " + current.options.C);
  $("#D").text("D. " + current.options.D);
  const accuracy = totalCount ? ((correctCount / totalCount) * 100).toFixed(1) : 0;
  $("#status").html(`來源：${current.source} (#${current.number})<br>正確/答題數: ${correctCount}/${totalCount} 正確率: ${accuracy}%`);
}

$(document).ready(function() {
  loadProblems();

  $(".option").click(function() {
    if (!current) return;
    const chosen = this.id;
    const correct = current.answer;
    if ($(".option.correct, .option.wrong").length) {
      // next problem
      showNextProblem();
      return;
    }

    // 更新統計
    totalCount++;
    if (chosen === correct) correctCount++;

    // 寫入 cookie
    document.cookie = "quiz_stats=" + encodeURIComponent(JSON.stringify({
      correct: correctCount,
      total: totalCount
    })) + "; path=/; max-age=" + (60 * 60 * 24 * 365);

    // 更新狀態顯示
    const accuracy = totalCount ? ((correctCount / totalCount) * 100).toFixed(1) : 0;
    $("#status").html(`來源：${current.source} (#${current.number})<br>正確/答題數: ${correctCount}/${totalCount} 正確率: ${accuracy}%`);

    if (chosen === correct) {
      $(this).addClass("correct");
    } else {
      $(this).addClass("wrong");
      $("#" + correct).addClass("correct");
    }
  });
});
