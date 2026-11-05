# Unit coverage and Codecov (OLS-4825)

`unit-test-coverage-pull-request.yaml` and `unit-test-coverage-push.yaml` are
standalone Pipelines-as-Code PipelineRuns that run the unit test suite with
coverage and upload the report to Codecov, for every PR targeting `main` and
every push to `main`. They share the task definition in
`pipelines/unit-test-coverage-pipeline.yaml`.

Uploads soft-fail: unit-test failures block the pipeline, Codecov failures do
not. The Codecov token lives in a Konflux secret that is injected only into
the upload step.

Design details, constraints, and secret setup live in
`.ai/spec/how/ci-pipelines.md`.
