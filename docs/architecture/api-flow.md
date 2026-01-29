# API Architecture Diagrams - First Steps

## Authentication Flow
Will use JWT tokens

```mermaid
sequenceDiagram
    participant Client
    participant AuthMW as Auth Middleware
    participant AuthService as Auth Service
    participant MongoDB
    participant JWTUtils as JWT Utils
    
    Client->>AuthService: POST /api/auth/login<br/>{email, password}
    AuthService->>MongoDB: Find user by email
    MongoDB-->>AuthService: User document
    
    alt Valid credentials
        AuthService->>JWTUtils: Generate JWT token<br/>{userId, role, exp}
        JWTUtils-->>AuthService: JWT token
        AuthService-->>Client: 200 OK<br/>{token, user: {id, role, name}}
        Note over Client: Store token in<br/>localStorage/session
    else Invalid credentials
        AuthService-->>Client: 401 Unauthorized<br/>{error: "Invalid credentials"}
    end
    
    Note over Client: Subsequent requests include<br/>token in Authorization header
    
    Client->>AuthMW: GET /api/patients<br/>Header: Authorization: Bearer {token}
    AuthMW->>JWTUtils: Verify and decode token
    JWTUtils-->>AuthMW: Decoded payload<br/>{userId, role}
    AuthMW->>AuthMW: Extract user info
    AuthMW->>Client: Continue to protected route
```

## Possible workflow for Protected Route Request Flow
Since we are dealing with patient records, this is confidential. We should consider a protected route request workflow for the same. Here's a possible workflow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant AuthMW as Auth Middleware
    participant RBACMW as RBAC Middleware
    participant ValidationMW as Validation Middleware
    participant Service as Domain Service
    participant MongoDB
    
    Client->>Gateway: HTTP Request<br/>(e.g., POST /api/patients)
    Gateway->>AuthMW: Route request
    
    AuthMW->>AuthMW: Extract JWT from<br/>Authorization header
    alt Token valid
        AuthMW->>AuthMW: Decode token<br/>Extract userId, role
        AuthMW->>RBACMW: Pass request with<br/>user context
    else Token invalid/missing
        AuthMW-->>Client: 401 Unauthorized
    end
    
    RBACMW->>RBACMW: Check role permissions<br/>for requested resource/action
    alt Permission granted
        RBACMW->>ValidationMW: Pass validated request
    else Permission denied
        RBACMW-->>Client: 403 Forbidden
    end
    
    ValidationMW->>ValidationMW: Validate request body<br/>Validate query parameters
    alt Validation passed
        ValidationMW->>Service: Pass validated data
    else Validation failed
        ValidationMW-->>Client: 400 Bad Request<br/>{errors: [...]}
    end
    
    Service->>MongoDB: Query/Update database
    MongoDB-->>Service: Return data
    
    Service->>Service: Process business logic<br/>Format response
    Service-->>Client: 200 OK<br/>{data: {...}}
```

## Service Interaction Flow
We'll be having a lot of services and they'll have to interact amongst each other. I've considered the mandatory Authentication, and the basic modules of Admission service, Patient service, Referral service. 

```mermaid
sequenceDiagram
    participant Client
    participant AdmissionService as Admission Service
    participant PatientService as Patient Service
    participant ReferralService as Referral Service
    participant AuthService as Auth Service
    participant MongoDB
    
    Note over Client,MongoDB: Example: Creating a new admission
    
    Client->>AdmissionService: POST /api/admissions<br/>{patientId, admissionType, ...}
    
    AdmissionService->>PatientService: Verify patient exists<br/>(internal call or shared model)
    PatientService->>MongoDB: Find patient by ID
    MongoDB-->>PatientService: Patient document
    PatientService-->>AdmissionService: Patient verified
    
    AdmissionService->>AuthService: Get current user info<br/>(from JWT context)
    AuthService-->>AdmissionService: User details
    
    AdmissionService->>MongoDB: Create admission document
    MongoDB-->>AdmissionService: Admission created
    
    alt If referral-based admission
        AdmissionService->>ReferralService: Update referral status<br/>to "completed"
        ReferralService->>MongoDB: Update referral
        ReferralService-->>AdmissionService: Referral updated
    end
    
    AdmissionService-->>Client: 201 Created<br/>{admission: {...}}
```

## Possible Endpoints
We'll add on to this as we go. Some things we need to discuss:  
 1) patient ids, appointment ids, staff ids
 2) how to query these together - basically database schema
 3) We need to employ all of CRUD

```
POST   /api/auth/register     - User registration
POST   /api/auth/login        - User login (returns JWT)
POST   /api/auth/refresh      - Refresh JWT token

GET    /api/patients          - List patients
POST   /api/patients          - Create new patient

GET    /api/admissions        - List admissions (with filters)
POST   /api/admissions        - Create new admission
GET    /api/admissions/active - Get all active admissions

GET    /api/referrals         - List referrals 
POST   /api/referrals         - Create new referral

GET    /api/appointments      - List appointments (with filters)
POST   /api/appointments      - Create new appointment

GET    /api/medical-records   - List medical records (with filters)
POST   /api/medical-records   - Create new medical record
```