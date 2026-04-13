package com.taskmanager.service;

import com.taskmanager.dto.DashboardResponse;
import com.taskmanager.entity.TaskStatus;
import com.taskmanager.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DashboardService {
    private final TaskRepository taskRepository;

    public DashboardService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public DashboardResponse getDashboard() {
        Map<String, Long> perUser = taskRepository.countTasksPerUser().stream().collect(Collectors.toMap(
                r -> (String) r[0], r -> (Long) r[1]));
        Map<String, Long> perProject = taskRepository.countTasksPerProject().stream().collect(Collectors.toMap(
                r -> (String) r[0], r -> (Long) r[1]));

        return DashboardResponse.builder()
                .totalTasks(taskRepository.count())
                .completedTasks(taskRepository.countByStatus(TaskStatus.COMPLETED))
                .pendingTasks(taskRepository.countByStatusNot(TaskStatus.COMPLETED))
                .overdueTasks(taskRepository.countByDueDateBeforeAndStatusNot(LocalDate.now(), TaskStatus.COMPLETED))
                .tasksPerUser(perUser)
                .tasksPerProject(perProject)
                .build();
    }
}
