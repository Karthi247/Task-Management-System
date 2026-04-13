package com.taskmanager.repository;

import com.taskmanager.entity.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    Page<Task> findByAssignedTo(User user, Pageable pageable);
    Page<Task> findByProject(Project project, Pageable pageable);
    Page<Task> findByStatus(TaskStatus status, Pageable pageable);
    Page<Task> findByPriority(TaskPriority priority, Pageable pageable);
    Page<Task> findByDueDateBetween(LocalDate start, LocalDate end, Pageable pageable);

    List<Task> findByAssignedTo(User user);
    List<Task> findByProject(Project project);
    List<Task> findByStatus(TaskStatus status);
    List<Task> findByPriority(TaskPriority priority);
    List<Task> findByDueDateBetween(LocalDate start, LocalDate end);
    List<Task> findTop5ByAssignedToOrderByDueDateAsc(User user);

    @Query("select t from Task t where lower(t.title) like lower(concat('%',:q,'%')) or lower(t.description) like lower(concat('%',:q,'%'))")
    Page<Task> search(@Param("q") String q, Pageable pageable);

    @Query("select t from Task t where lower(t.title) like lower(concat('%',:q,'%')) or lower(t.description) like lower(concat('%',:q,'%'))")
    List<Task> search(@Param("q") String q);

    @Query("select t from Task t where t.assignedTo = :user and (lower(t.title) like lower(concat('%',:q,'%')) or lower(t.description) like lower(concat('%',:q,'%')))")
    Page<Task> searchByAssignee(@Param("user") User user, @Param("q") String q, Pageable pageable);

    @Query("select t from Task t where t.assignedTo = :user and (lower(t.title) like lower(concat('%',:q,'%')) or lower(t.description) like lower(concat('%',:q,'%')))")
    List<Task> searchByAssignee(@Param("user") User user, @Param("q") String q);

    long countByStatus(TaskStatus status);
    long countByStatusNot(TaskStatus status);
    long countByDueDateBeforeAndStatusNot(LocalDate date, TaskStatus status);

    @Query("select t.assignedTo.name, count(t) from Task t where t.assignedTo is not null group by t.assignedTo.name")
    List<Object[]> countTasksPerUser();

    @Query("select t.project.name, count(t) from Task t group by t.project.name")
    List<Object[]> countTasksPerProject();
}
