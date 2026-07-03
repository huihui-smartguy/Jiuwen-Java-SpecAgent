# {{FEATURE_NAME}}测试用例

## 文档元数据

- 特性编号：{{FEATURE_ID}}
- SA 负责人：{{SA_OWNER}}
- 目标版本：{{TARGET_VERSION}}
- 文档状态：{{DOC_STATUS}}

---

## 一、特性概述

- **特性描述**：{{FEATURE_DESCRIPTION}}
- **业务价值**：{{BUSINESS_VALUE}}

---

## 二、测试环境准备

### 2.1 环境依赖

{{ENV_DEPENDENCIES}}

### 2.2 配置文件

{{CONFIG_FILES}}

---

## 三、基础功能测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

2. {{STEP_2_DESCRIPTION}}

3. {{STEP_N_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 四、数据流转测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

2. {{STEP_2_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

3. {{STEP_N_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 五、数据隔离测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

2. {{STEP_2_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

3. {{STEP_N_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 六、异常场景测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}

2. {{STEP_2_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 七、高级功能测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

2. {{STEP_2_DESCRIPTION}}:
```bash
curl -X {{METHOD}} {{URL}} \
  -H "{{HEADER_1}}" \
  -H "{{HEADER_2}}" \
  -d '{
    {{REQUEST_BODY}}
  }'
```

3. {{STEP_N_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 八、性能与并发测试

### {{TEST_CASE_ID}} {{TEST_CASE_NAME}}

**测试目标**: {{TEST_OBJECTIVE}}

**前置条件**:
{{PRECONDITIONS}}

**测试步骤**:

1. {{STEP_1_DESCRIPTION}}

2. {{STEP_2_DESCRIPTION}}

**预期结果**:
{{EXPECTED_RESULTS}}

**验证点**:
- [ ] {{VERIFICATION_POINT_1}}
- [ ] {{VERIFICATION_POINT_2}}
- [ ] {{VERIFICATION_POINT_N}}

---

## 九、总结

本测试用例文档完整覆盖了{{FEATURE_NAME}}的所有功能特性:

### 测试分类统计
- 基础功能测试({{BASIC_TEST_COUNT}}个)
- 数据流转测试({{DATA_FLOW_TEST_COUNT}}个)
- 数据隔离测试({{ISOLATION_TEST_COUNT}}个)
- 异常场景测试({{EXCEPTION_TEST_COUNT}}个)
- 高级功能测试({{ADVANCED_TEST_COUNT}}个)
- 性能与并发测试({{PERFORMANCE_TEST_COUNT}}个)

**总计{{TOTAL_TEST_COUNT}}个测试用例**,完整覆盖{{FEATURE_NAME}}的核心功能特性。

### 核心观测点
1. **API响应验证**: 确认HTTP状态码、响应体格式、业务数据正确性
2. **日志关键词**: "{{LOG_KEYWORD_1}}", "{{LOG_KEYWORD_2}}", "{{LOG_KEYWORD_N}}"
3. **数据流转**: 验证{{DATA_FLOW_DESCRIPTION}}
4. **隔离机制**: 验证{{ISOLATION_MECHANISM}}
5. **异常处理**: 验证{{EXCEPTION_HANDLING}}
6. **性能指标**: 响应时间{{PERFORMANCE_METRICS}}

所有测试用例均基于REST API执行,可通过curl命令直接验证,并通过日志和响应结果确认测试通过。

### 测试执行清单
- [ ] 测试环境准备完成
- [ ] 所有测试用例执行完成
- [ ] 所有验证点检查通过
- [ ] 测试报告已生成
- [ ] 缺陷已记录并跟踪
