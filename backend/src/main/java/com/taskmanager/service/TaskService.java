package com.taskmanager.service;

import com.taskmanager.dto.TaskRequest;
import com.taskmanager.dto.TaskResponse;
import com.taskmanager.entity.*;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.repository.TaskRepository;
import com.taskmanager.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository, ProjectService projectService) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
    }

    public Page<TaskResponse> list(Long userId, Long projectId, TaskStatus status, TaskPriority priority, String q, LocalDate dueFrom, LocalDate dueTo, int page, int size, Authentication auth) {
        PageRequest pageable = PageRequest.of(page, size);
        boolean isMember = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MEMBER"));

        if (isMember) {
            User user = userRepository.findByEmail(auth.getName()).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            if (q != null && !q.isBlank()) {
                return taskRepository.searchByAssignee(user, q, pageable).map(this::toResponse);
            }
            return taskRepository.findByAssignedTo(user, pageable).map(this::toResponse);
        }
        if (userId != null) {
            User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            return taskRepository.findByAssignedTo(user, pageable).map(this::toResponse);
        }
        if (projectId != null) {
            return taskRepository.findByProject(projectService.getEntity(projectId), pageable).map(this::toResponse);
        }
        if (status != null) {
            return taskRepository.findByStatus(status, pageable).map(this::toResponse);
        }
        if (priority != null) {
            return taskRepository.findByPriority(priority, pageable).map(this::toResponse);
        }
        if (dueFrom != null && dueTo != null) {
            return taskRepository.findByDueDateBetween(dueFrom, dueTo, pageable).map(this::toResponse);
        }
        if (q != null && !q.isBlank()) {
            return taskRepository.search(q, pageable).map(this::toResponse);
        }
        return taskRepository.findAll(pageable).map(this::toResponse);
    }

    public List<TaskResponse> listForReport(Long userId, Long projectId, TaskStatus status, TaskPriority priority, String q, LocalDate dueFrom, LocalDate dueTo, Authentication auth) {
        boolean isMember = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MEMBER"));

        if (isMember) {
            User user = userRepository.findByEmail(auth.getName()).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            if (q != null && !q.isBlank()) {
                return taskRepository.searchByAssignee(user, q).stream().map(this::toResponse).toList();
            }
            return taskRepository.findByAssignedTo(user).stream().map(this::toResponse).toList();
        }
        if (userId != null) {
            User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            return taskRepository.findByAssignedTo(user).stream().map(this::toResponse).toList();
        }
        if (projectId != null) {
            return taskRepository.findByProject(projectService.getEntity(projectId)).stream().map(this::toResponse).toList();
        }
        if (status != null) {
            return taskRepository.findByStatus(status).stream().map(this::toResponse).toList();
        }
        if (priority != null) {
            return taskRepository.findByPriority(priority).stream().map(this::toResponse).toList();
        }
        if (dueFrom != null && dueTo != null) {
            return taskRepository.findByDueDateBetween(dueFrom, dueTo).stream().map(this::toResponse).toList();
        }
        if (q != null && !q.isBlank()) {
            return taskRepository.search(q).stream().map(this::toResponse).toList();
        }
        return taskRepository.findAll().stream().map(this::toResponse).toList();
    }

    public TaskResponse create(TaskRequest request, Authentication auth) {
        User creator = userRepository.findByEmail(auth.getName()).orElseThrow(() -> new ResourceNotFoundException("Creator not found"));
        String title = requireTitle(request.getTitle());
        User assignee = request.getAssignedToId() == null ? null : userRepository.findById(request.getAssignedToId())
                .orElseThrow(() -> new ResourceNotFoundException("Assignee not found"));
        if (request.getProjectId() == null) {
            throw new IllegalArgumentException("Project is required");
        }

        Task task = Task.builder()
                .title(title)
                .description(normalizeText(request.getDescription()))
                .statusUpdateNote(request.getStatusUpdateNote())
                .status(request.getStatus() == null ? TaskStatus.TODO : request.getStatus())
                .priority(request.getPriority() == null ? TaskPriority.MEDIUM : request.getPriority())
                .dueDate(request.getDueDate())
                .createdBy(creator)
                .assignedTo(assignee)
                .project(projectService.getEntity(request.getProjectId()))
                .build();

        return toResponse(taskRepository.save(task));
    }

    public TaskResponse update(Long id, TaskRequest request, Authentication auth) {
        Task task = taskRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        boolean isMember = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MEMBER"));
        if (isMember && (task.getAssignedTo() == null || !task.getAssignedTo().getEmail().equals(auth.getName()))) {
            throw new IllegalArgumentException("Members can update only their own tasks");
        }
        if (request.getTitle() != null) task.setTitle(requireTitle(request.getTitle()));
        if (request.getDescription() != null) task.setDescription(normalizeText(request.getDescription()));
        if (request.getStatusUpdateNote() != null) task.setStatusUpdateNote(normalizeText(request.getStatusUpdateNote()));
        if (request.getStatus() != null) task.setStatus(request.getStatus());
        if (request.getPriority() != null) task.setPriority(request.getPriority());
        if (request.getDueDate() != null) task.setDueDate(request.getDueDate());
        if (request.getAssignedToId() != null) task.setAssignedTo(userRepository.findById(request.getAssignedToId())
                .orElseThrow(() -> new ResourceNotFoundException("Assignee not found")));
        if (request.getProjectId() != null) task.setProject(projectService.getEntity(request.getProjectId()));
        return toResponse(taskRepository.save(task));
    }

    public void delete(Long id) {
        if (!taskRepository.existsById(id)) throw new ResourceNotFoundException("Task not found");
        taskRepository.deleteById(id);
    }

    private TaskResponse toResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .statusUpdateNote(task.getStatusUpdateNote())
                .status(task.getStatus())
                .priority(task.getPriority())
                .dueDate(task.getDueDate())
                .createdBy(task.getCreatedBy().getEmail())
                .assignedTo(task.getAssignedTo() == null ? null : task.getAssignedTo().getEmail())
                .projectName(task.getProject().getName())
                .build();
    }

    private String requireTitle(String title) {
        String value = normalizeText(title);
        if (value == null) {
            throw new IllegalArgumentException("Task title is required");
        }
        return value;
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }
}
