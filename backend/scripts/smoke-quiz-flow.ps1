# Quiz session smoke test (dev server on :5000 must be running)
$ErrorActionPreference = 'Stop'
$uuid = [guid]::NewGuid().ToString()
$h = @{ 'X-Anonymous-Id' = $uuid; 'Content-Type' = 'application/json' }

$health = Invoke-RestMethod http://localhost:5000/api/health
Write-Output "HEALTH: $($health.status)"

$start = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/quizzes/1/start -Headers $h -Body '{"ageConsent":true,"ageYears":16}'
$aid = $start.attempt.attemptId
Write-Output "START: attempt=$aid status=$($start.attempt.status) q=$($start.attempt.questions.Count)"

$state = $start.attempt
for ($i = 0; $i -lt $state.questions.Count; $i++) {
  if ($i -gt 0) {
    $view = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/quizzes/attempts/$aid/view" -Headers $h -Body (@{position=$i} | ConvertTo-Json)
    $state = $view.attempt
  }
  $q = $state.questions[$i]
  $ans = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/quizzes/attempts/$aid/answer" -Headers $h -Body (@{questionId=$q.id; optionIndex=0; timeSpentMs=(2000 + $i * 500)} | ConvertTo-Json)
  $state = $ans.attempt
  Write-Output "ANSWER $($i+1): q=$($q.id) saved"
}

$fin = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/quizzes/attempts/$aid/finalize" -Headers $h -Body '{"partial":false}'
Write-Output "FINAL: status=$($fin.status) score=$($fin.score)/$($fin.total) analyticsAvailable=$($fin.analytics.available) reason=$($fin.analytics.reason)"

$result = Invoke-RestMethod -Uri "http://localhost:5000/api/quizzes/attempts/$aid/result" -Headers $h
Write-Output "RESULT: timings=$(( $result.results | Where-Object { $_.timeSpentMs -ne $null } ).Count) questions with timeSpentMs"

# Resume after finalize should show final status
$resume = Invoke-RestMethod -Uri "http://localhost:5000/api/quizzes/attempts/$aid" -Headers $h
Write-Output "RESUME-AFTER: status=$($resume.attempt.status)"

# Timed quiz start (quiz 2): deadlines must be present
$start2 = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/quizzes/2/start -Headers $h -Body '{"ageConsent":false}'
Write-Output "TIMED: mode=$($start2.attempt.timeMode) totalDeadline=$([bool]$start2.attempt.totalDeadlineAt) qDeadline=$([bool]$start2.attempt.questionDeadlineAt)"

# Suggestions flow (dictionary)
$word = (Invoke-RestMethod 'http://localhost:5000/api/tusindirme/sozler?page=1&limit=1').data[0]
if ($word) {
  $detail = Invoke-RestMethod "http://localhost:5000/api/tusindirme/soz/$($word.id)" -Headers $h
  $descId = $detail.data.aniqlamalar[0].id
  if ($descId) {
    $sw = "smoke_$([guid]::NewGuid().ToString('N').Substring(0,6))"
    $sug = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/tusindirme/suggestions -Headers $h -Body (@{suggestionType='synonym'; descriptionId=$descId; suggestedWord=$sw} | ConvertTo-Json)
    Write-Output "SUGGEST: id=$($sug.id) status=$($sug.status)"
    $h2 = @{ 'X-Anonymous-Id' = [guid]::NewGuid().ToString(); 'Content-Type' = 'application/json' }
    $vote = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/tusindirme/suggestions/$($sug.id)/vote" -Headers $h2 -Body '{"vote":"up"}'
    Write-Output "VOTE: up=$($vote.upvotes) down=$($vote.downvotes) status=$($vote.status)"
  }
}

Write-Output "SMOKE OK"
