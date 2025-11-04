let problems = [];
let current = null;

function loadProblems() {
  console.log("getting problem_sources.json")
  $.getJSON("problem_sources.json", function(sources) {
    console.log("got problem_sources.json")
    let pending = sources.length;
    sources.forEach(src => {
      $.getJSON(src, function(data) {
        console.log(`got ${src}.json`)
        problems.push(...data.problems);
      }).always(() => {
        if (--pending === 0) showNextProblem();
      });
    });
  });
}

function showNextProblem() {
  $(".option").removeClass("correct wrong");
  current = problems[Math.floor(Math.random() * problems.length)];
  if (!current) return;

  $("#problem").text(current.question);
  $("#A").text("A. " + current.options.A);
  $("#B").text("B. " + current.options.B);
  $("#C").text("C. " + current.options.C);
  $("#D").text("D. " + current.options.D);
  $("#status").text(`來源：${current.source} (#${current.number})`);
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
    if (chosen === correct) {
      $(this).addClass("correct");
    } else {
      $(this).addClass("wrong");
      $("#" + correct).addClass("correct");
    }
  });
});
