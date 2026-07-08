# 故障-契约对齐报告（match_faults.py 自动产出）

- 故障库版本：1.1.0
- 匹配故障数：21（降级 1）

| fault_id | 场景 | 分支 | 优先级 | 调和 | oracle(spec_id:level:authority) |
|---|---|---|---|---|---|
| F-REQ-011 | FS-001 | exception | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-PROTO-001 | FS-001 | exception | P1 | aligned | SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-PROTO-002 | FS-001 | exception | P1 | aligned | SPEC-ERR-32700:L2:spec-required; SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-RES-001 | FS-001 | quality | P1 | aligned | SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-RES-002 | FS-001 | quality | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-002 | FS-001 | boundary | P2 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-004 | FS-001 | boundary | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-006 | FS-001 | boundary | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-REQ-011 | FS-002 | exception | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-PROTO-001 | FS-002 | exception | P1 | aligned | SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-PROTO-002 | FS-002 | exception | P1 | aligned | SPEC-ERR-32700:L2:spec-required; SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-SSE-001 | FS-002 | quality | P1 | aligned | SPEC-SSE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-SSE-002 | FS-002 | quality | P1 | aligned | SPEC-SSE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-002 | FS-002 | boundary | P2 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-004 | FS-002 | boundary | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-STATE-006 | FS-002 | boundary | P1 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-HIST-001 | FS-001 | quality | P0 | aligned | SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-HIST-002 | FS-001 | quality | P0 | aligned | SPEC-RESP-WRAP:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-HIST-003 | FS-001 | exception | P0 | aligned | SPEC-ERR-32603:L2:spec-required; SPEC-ID-TYPE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required |
| F-HIST-004 | FS-002 | quality | P0 | aligned | SPEC-SSE:L2:spec-required; SPEC-RESP-WRAP:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
| F-HIST-005 | FS-001 | quality | P0 | downgraded | SPEC-CARD:L0:needs-runtime-verify; SPEC-CARD-URL:L1:deployment-config-dependent; SPEC-RESP-WRAP:L2:spec-required; SPEC-ID-TYPE:L2:spec-required |
