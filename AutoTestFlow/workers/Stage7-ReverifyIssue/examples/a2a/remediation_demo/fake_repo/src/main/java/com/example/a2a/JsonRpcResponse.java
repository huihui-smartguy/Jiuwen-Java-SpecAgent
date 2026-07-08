package com.example.a2a;

/** JSON-RPC 响应封装（回带请求 id + result）。 */
public class JsonRpcResponse {

    private final Object id;
    private final Object result;

    public JsonRpcResponse(Object id, Object result) {
        // BUG(TC_042 / SPEC-ID-TYPE / F-HIST-001): id 原样回带；上游以 int 传入，
        // 导致响应 id 为数字。契约要求 id 一律以字符串回带。
        this.id = id;
        this.result = result;
    }

    public Object getId() {
        return id;
    }

    public Object getResult() {
        return result;
    }
}
