package com.smartcalendar;

import com.smartcalendar.service.UserService;
import com.smartcalendar.service.TaskService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class SmartCalendarBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(SmartCalendarBackendApplication.class, args);
	}

	@Bean
	CommandLineRunner initializeDefaultUser(UserService userService, TaskService taskService) {
		return args -> {
			userService.ensureDefaultUser("prem", "admin123", "ADMIN");
			taskService.assignLegacyTasksToDefaultUser("prem");
		};
	}
}

