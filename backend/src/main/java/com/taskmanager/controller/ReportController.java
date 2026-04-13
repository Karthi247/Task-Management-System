package com.taskmanager.controller;

import com.taskmanager.dto.DashboardResponse;
import com.taskmanager.dto.TaskResponse;
import com.taskmanager.entity.TaskPriority;
import com.taskmanager.entity.TaskStatus;
import com.taskmanager.service.DashboardService;
import com.taskmanager.service.TaskService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final DashboardService dashboardService;
    private final TaskService taskService;

    public ReportController(DashboardService dashboardService, TaskService taskService) {
        this.dashboardService = dashboardService;
        this.taskService = taskService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<DashboardResponse> dashboard() {
        return ResponseEntity.ok(dashboardService.getDashboard());
    }

    @GetMapping("/tasks")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','MEMBER')")
    public ResponseEntity<List<TaskResponse>> tasks(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) TaskPriority priority,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            Authentication authentication) {
        return ResponseEntity.ok(taskService.listForReport(userId, projectId, status, priority, q, dueFrom, dueTo, authentication));
    }
}
