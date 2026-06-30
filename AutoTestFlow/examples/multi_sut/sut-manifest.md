---
schema_version: autotestflow.sut-manifest.v1
suite:
  id: checkout-multi-sut
  output_dir: analysis_output
  defaults:
    knowledge_domain: rest_api
targets:
  - id: catalog
    name: Catalog API
    role: dependency
    source:
      path: ../../examples/a2a/remediation_demo/fake_repo
    runtime:
      mode: predeployed
      base_url: http://localhost:8081
      readiness_probe:
        method: GET
        path: /health
        expect_status_lt: 500
    probes:
      - name: health
        method: GET
        path: /health
        accept: application/json
      - name: malformed_body
        method: POST
        path: /catalog/items
        accept: application/json
        body: "{bad json"
  - id: checkout
    name: Checkout API
    role: primary
    depends_on: [catalog]
    source:
      path: ../../examples/a2a/remediation_demo/fake_repo
    runtime:
      mode: managed
      base_url: http://localhost:8082
      readiness_probe:
        method: GET
        path: /actuator/health
        expect_status_lt: 500
      commands:
        build: "mvn -q -DskipTests package"
        start: "java -jar target/checkout.jar --server.port=8082"
        stop: "pkill -f checkout.jar || true"
    remediation:
      config_path: remediation.config.json
---

# Multi-SUT Example

This example models a primary checkout service that depends on a catalog
service. AutoTestFlow normalizes both targets into independent output folders
under `analysis_output/targets/<target_id>/`, then aggregates their reports at
the suite root.
