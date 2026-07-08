package com.example.a2a;

/** 智能体注册表：判断 agentId 是否存在（用于关联资源校验）。 */
@FunctionalInterface
public interface AgentRegistry {
    boolean exists(String agentId);
}
