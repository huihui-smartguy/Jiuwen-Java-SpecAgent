# AutoTestFlow Quickstart Starters

## 中文

这组文件用于默认命令的入门准备。把它们复制到你的项目根目录，再按真实 SUT 修改：

```bash
cp AutoTestFlow/examples/quickstart/autotestflow.suts.md .
cp AutoTestFlow/examples/quickstart/remediation.config.json .
```

- `autotestflow.suts.md`：自然语言 SUT 描述。更多写法见 `AutoTestFlow/shared/sut_manifest_schema.md`。
- `remediation.config.json`：门控修复配置。默认 `switches.allow_open_issue=false`，不会外发 issue。完整模板见 `AutoTestFlow/examples/remediation.config.example.json`，schema 见 `AutoTestFlow/shared/remediation_config_schema.md`。

验证输入：

```bash
python AutoTestFlow/scripts/sut_manifest.py --sut-manifest autotestflow.suts.md
python AutoTestFlow/reference/remediation_config.py --check remediation.config.json
```

## English

These starter files prepare the inputs used by the default command. Copy them
to your project root, then replace the placeholder values with your real SUT
details:

```bash
cp AutoTestFlow/examples/quickstart/autotestflow.suts.md .
cp AutoTestFlow/examples/quickstart/remediation.config.json .
```

- `autotestflow.suts.md`: natural-language SUT description. See `AutoTestFlow/shared/sut_manifest_schema.md` for more formats.
- `remediation.config.json`: gated remediation config. It keeps `switches.allow_open_issue=false` by default, so it will not publish issues. See `AutoTestFlow/examples/remediation.config.example.json` and `AutoTestFlow/shared/remediation_config_schema.md` for the full template and schema.

Validate the inputs:

```bash
python AutoTestFlow/scripts/sut_manifest.py --sut-manifest autotestflow.suts.md
python AutoTestFlow/reference/remediation_config.py --check remediation.config.json
```
