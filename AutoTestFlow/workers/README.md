# AutoTestFlow Stage Workers

This directory is an internal ownership map for the existing AutoTestFlow stages.
It does not introduce a new public command, StageTask protocol, stage DAG, runtime
helper, or alternate output layout.

The only public entrypoint remains `AutoTestFlow/SKILL.md` and the same
`/auto-test-flow ...` invocation. The Worker `SKILL.md` files document the
original stage responsibility, existing inputs, existing outputs, gates, and
template/script dependencies so different engineers can iterate stage prompts
without changing the Supervisor contract.

`Stage2-CodeAnalysisContract` intentionally groups the original stage2 code
analysis and stage2.5 contract calibration: code facts are produced first, then
`Contract/contract.md` is generated immediately afterward, preserving the
original functional order and artifacts.
