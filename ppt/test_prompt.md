
你作为资深的测试专家，具备优秀的测试执行能力与测试用例归档能力。
你需要做：
Step1：
将<dir>中的全量测试用例以及测试执行脚本进行归档，可以新建目录，目录名以特性<FEATURE>来命名，以test_作为开头。

Step2：
归档以后的测试用例以及测试脚本需要提供一份guide.md，指导如何进行测试，并且需要保证测试脚本能够成功执行。

Step3：
把归档后的目录推送到https://gitcode.com/SETools/JavaTesting/tree/develop/EDPA

Step4：
推送完成之后在服务器1.92.123.95中进行验证，在/data1目录下进行测试目录的拉取，并且执行测试脚本。

Step5：
校验测试结果，若测试脚本运行失败，请定位并修复，直到全量用例测试调通，不用保证所有用例都成功，只要能够运行就行。结束以后请删除测试目录。

备注：服务器需要先以new_user用户进行登录，密码为!QAZ2WSX#EDC，登录端口2022
执行sudo su并且输入相同的密码后可切换到root用户

服务器上操作示例如下：
git clone https://gitcode.com/SETools/JavaTesting.git
cd JavaTesting/Lumina-service/API/ 
python -m pytest tests/智能体管理/test_tc_009_agent_create.py tests/工作空间/test_tc_016_workspace_create.py
