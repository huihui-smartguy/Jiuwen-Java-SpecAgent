package com.example.a2a;

/** A2A JSON-RPC 入口：POST /a2a 派发到 TaskService，并封装 JSON-RPC 响应。 */
public class A2aJsonRpcController {

    private final TaskService taskService;

    public A2aJsonRpcController(TaskService taskService) {
        this.taskService = taskService;
    }

    public JsonRpcResponse handle(int id, String method, String agentId, String text) {
        TaskResult result = taskService.handle(agentId, text);
        // id 以 int 传入 JsonRpcResponse —— 见 JsonRpcResponse 的 SPEC-ID-TYPE 缺陷
        return new JsonRpcResponse(id, result);
    }
}
