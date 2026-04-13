package com.taskmanager.dto;

import com.taskmanager.entity.TaskPriority;
import com.taskmanager.entity.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private String statusUpdateNote;
    private TaskStatus status;
    private TaskPriority priority;
    private LocalDate dueDate;
    private String createdBy;
    private String assignedTo;
    private String projectName;
}
