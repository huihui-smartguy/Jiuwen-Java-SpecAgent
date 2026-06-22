package com.example.a2a;

/** 任务结果（终态 state：COMPLETED / FAILED / ...）。 */
public class TaskResult {

    private final String state;

    public TaskResult(String state) {
        this.state = state;
    }

    public String getState() {
        return state;
    }
}
