package com.example.a2a;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** 占位自测，确保 src/test 目录存在（回归用例由 auto-remediation 以新增文件方式注入）。 */
public class SmokeTest {
    @Test
    void contextLoads() {
        assertNotNull(new TaskResult("COMPLETED").getState());
    }
}
