# Multi-SUT Test Environment

[Catalog]
Role: dependency
Source path: ../../examples/a2a/remediation_demo/fake_repo
URL: http://localhost:8081/health
Accessible directly

[Checkout]
Role: primary
Source path: ../../examples/a2a/remediation_demo/fake_repo
URL: http://localhost:8082/actuator/health
Requires creation in conjunction with Catalog
Build: mvn -q -DskipTests package
Start: java -jar target/checkout.jar --server.port=8082
Stop: pkill -f checkout.jar || true
Remediation config: remediation.config.json

This example models a primary checkout service that depends on a catalog
service. AutoTestFlow normalizes both targets into independent output folders
under `analysis_output/targets/<target_id>/`, then aggregates their reports at
the suite root.
