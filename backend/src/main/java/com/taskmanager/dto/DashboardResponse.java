package com.taskmanager.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class DashboardResponse {
    private long totalTasks;
    private long completedTasks;
    private long pendingTasks;
    private long overdueTasks;
    private Map<String, Long> tasksPerUser;
    private Map<String, Long> tasksPerProject;
}
