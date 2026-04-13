# Task Management System (Backend)

Role-Based Task Management backend built with Spring Boot, MySQL, JWT, and Spring Security.

## Tech Stack
- Java 17
- Spring Boot 3
- Spring Security + JWT
- Spring Data JPA
- MySQL
- Maven
- Lombok
- OpenAPI/Swagger

## Project Structure

```text
src/main/java
└── com/taskmanager
    ├── config
    │   ├── SecurityConfig.java
    │   ├── JwtConfig.java
    │   ├── DataInitializer.java
    ├── controller
    │   ├── AuthController.java
    │   ├── UserController.java
    │   ├── ProjectController.java
    │   ├── TaskController.java
    │   ├── DashboardController.java
    ├── dto
    ├── entity
    ├── repository
    ├── security
    ├── service
    ├── exception
    └── util
```

## Roles and Access
- **ADMIN**: full access
- **MANAGER**: task and project access
- **MEMBER**: read tasks and update own tasks

## API Highlights
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/users` (ADMIN only)
- `GET/POST/PUT/DELETE /api/projects`
- `GET/POST/PUT/DELETE /api/tasks` (with pagination + filters)
- `GET /api/dashboard`

## Task Filters
`GET /api/tasks?userId=&projectId=&status=&priority=&page=0&size=10`

## Database Design
Reference DDL is available at:
- `src/main/resources/schema-reference.sql`

Tables:
- `users`
- `roles`
- `user_roles`
- `projects`
- `tasks`

## Swagger
Run application and open:
- `http://localhost:8080/swagger-ui/index.html`

## Run
1. Configure MySQL in `src/main/resources/application.yml`
2. Start app:
   ```bash
   mvn spring-boot:run
   ```

On startup, seeded runtime users/data are created automatically (if not present):
- `admin@taskmanager.com / admin123`
- `manager@taskmanager.com / manager123`
- `member@taskmanager.com / member123`

## Runtime Output (real API response)
After app is running, execute:
```bash
./scripts/runtime-demo.sh
```

This script performs login and live API calls (`/api/users`, `/api/tasks`, `/api/dashboard`) and prints the actual runtime JSON response from your running backend.

## Tests
```bash
mvn test
```
