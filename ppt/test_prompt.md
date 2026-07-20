
大家把脚本放到git仓，
https://gitcode.com/SETools/JavaTesting

要求：
1.脚本需要放在对应的文件夹下，每个特性是一个文件夹，参考已有脚本代码
EDPA是高码java
Lumina-service是合一版本
Python-high-core是高码python
高码runtime没有，涉及就创建一个文件夹

2.脚本需要提供执行方式，并在蓝区
1.92.123.95 new_user/!QAZ2WSX#EDC  端口2022
su
!QAZ2WSX#EDC
的/data1上创建一个文件夹并执行，将git拉取到执行成功的命令给出，样例如下：

git clone https://gitcode.com/SETools/JavaTesting.git
cd JavaTesting/Lumina-service/API/

# 执行多个测试用例文件 
python -m pytest tests/智能体管理/test_tc_009_agent_create.py tests/工作空间/test_tc_016_workspace_create.py
