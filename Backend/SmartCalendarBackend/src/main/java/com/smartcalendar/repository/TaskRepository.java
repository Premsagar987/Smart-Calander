package com.smartcalendar.repository;

import com.smartcalendar.entity.Task;
import com.smartcalendar.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    Page<Task> findAllByOwner_Username(String username, Pageable pageable);

    List<Task> findAllByOwner_Username(String username);

    List<Task> findByOwner_UsernameAndTitleContainingIgnoreCase(String username, String title);

    List<Task> findByOwner_UsernameAndCategoryIgnoreCase(String username, String category);

    List<Task> findByOwner_UsernameAndStatusIgnoreCase(String username, String status);

    List<Task> findAllByOwner_UsernameOrderByDateAsc(String username);

    List<Task> findAllByOwner_UsernameOrderByPriorityAsc(String username);

    long countByOwner_Username(String username);

    long countByOwner_UsernameAndCompleted(String username, Boolean completed);

    Optional<Task> findByIdAndOwner_Username(Long id, String username);

    @Modifying
    @Query("update Task task set task.owner = :owner where task.owner is null")
    int assignUnownedTasksToUser(@Param("owner") User owner);

}