package com.example.a2a;

/** 处理 A2A SendMessage：根据 metadata.agentId 派发任务。 */
public class TaskService {

    private final AgentRegistry registry;

    public TaskService(AgentRegistry registry) {
        this.registry = registry;
    }

    public TaskResult handle(String agentId, String text) {
        // BUG(TC_041 / SPEC-RESP-WRAP / F-REQ-011): 未校验 agentId 是否存在，
        // 对不存在的关联资源仍返回 COMPLETED；契约要求终态 FAILED。
        return new TaskResult("COMPLETED");
    }
}
