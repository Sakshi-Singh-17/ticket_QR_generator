1.
You are acting as a Product Manager and senior software architect.
Analyze the entire requirements for the project below:
Project: Digital Ticket QR Code Generator Worker
Problem:
Client's floor staff is having difficulties handling ticket QR code generation using paper and Excel and causes data loss and slows down the whole process. We need to build a simple digital Ticket QR Code Generator worker for the floor staff to use.

Requirements:
The user should be able to see the Ticket QR Code Generator page clearly
The application should work fast enough for the end-user
The application should have consistent data
The application should not show empty states incorrectly; it should display a user-friendly message saying no data was found instead of just being empty
The application should handle intermittent internet issues gracefully, showing a loading indicator when the app is performing an asynchronous request
The application should prevent invalid or empty values on form fields; the fields should be highlighted as invalid if the user tries to submit the form
The app should target a 100% Lighthouse accessibility score
The interactive elements should have the proper labels and ARIA attributes and be keyboard accessible
The app should have simulated analytics logging of important events
The app should sanitize user input against XSS before writing it into the application's state
The application should use a clean, monochrome corporate design system
The application should not utilize any custom colors or use random styling

Do not write any implementation code yet.
Instead, list:
Functional requirements
Acceptance criteria
Edge cases/unhappy paths
Non-functional requirements
Security considerations
Accessibility considerations
Main user flow


2.
Based on the requirements and acceptance criteria we just established, design the definitive database schema for the Digital Ticket QR Code Generator Worker.
Do NOT write application/feature code.
Provide:

Required tables/entities
Fields for every table
Data types
Primary keys
Foreign keys
Required vs optional fields
Unique constraints
Default values
Appropriate indexes
Relationships between entities
Explanation of why each entity and important field is required
ERD representation in Mermaid syntax

The schema should support:
- Ticket creation
- Ticket identification
- QR code generation/storage or QR-related data
- Ticket status
- Timestamps
- Validation
- Consistent structured data
- Future scalability

Keep the schema simple enough for the current capstone project. Do not introduce unnecessary tables or complexity.
Do not implement the database yet. This step is architecture/design only.


3.
Using the approved database schema and project requirements, define the API contracts for the Digital Ticket QR Code Generator Worker.

Do NOT implement the APIs yet.

Define the required endpoints for:

- Creating a ticket
- Retrieving tickets
- Retrieving a single ticket
- Searching/filtering tickets if required
- Generating/retrieving QR-related information
- Any other endpoint that is genuinely necessary

For every endpoint provide:

1. HTTP method
2. Endpoint path
3. Purpose
4. Request parameters/body
5. Request validation rules
6. Successful response structure
7. HTTP status codes
8. Error response structure
9. Relevant edge cases
10. Security considerations

Make sure the API contracts are consistent with the database schema.
Do not write implementation code.


4.
Now act as a senior QA engineer following Test-Driven Development (TDD).
Using the approved requirements, acceptance criteria, database schema, and API contracts, create the complete test plan for the Digital Ticket QR Code Generator Worker.
IMPORTANT:
Do NOT write the actual implementation code.
Write the tests/test specifications FIRST.

The tests must cover:
Successful ticket creation
Valid ticket input
Missing required fields
Invalid/malformed input
Duplicate/invalid ticket identifiers where applicable
Empty search/list results
"No data found" user-friendly state
Loading state during asynchronous operations
Slow/failed network requests
API/server errors
QR generation/retrieval behavior
Input sanitization against XSS
Analytics/telemetry event logging
Keyboard accessibility
Proper labels/ARIA attributes
Error messages and field highlighting
Successful end-to-end user flow
Relevant boundary and edge cases

Use the testing framework appropriate for the selected tech stack.
Create tests that initially fail because the implementation does not exist yet.
Do not modify implementation code to make the tests pass.


5.
Now perform a complete unhappy-path verification of the Digital Ticket QR Code Generator Worker.
Do not add unnecessary features.
Verify the following manually and through tests where possible:

Empty list/search result - Must display "No data found" instead of a blank screen.

Slow network - Must display a visible loading state during asynchronous operations.

Failed network/API request- Must show a user-friendly error state and must not crash.

Missing required input - Submission must be prevented and the invalid field must be highlighted.

Malformed/invalid input - Validation must prevent invalid submission.

XSS-style input - Input must be safely sanitized and must not execute as HTML/JavaScript.

Duplicate or conflicting data - Must be handled gracefully.

Refresh/reload during normal usage - Application must not enter an unrecoverable state.

For every case, report:
- Test performed
- Expected result
- Actual result
- Pass/Fail
- Any fix required
Do not remove existing tests.


6.
Now audit the completed application specifically for accessibility.
The target is a 100% Lighthouse accessibility score.
Check:

- Semantic HTML
- Form labels
- Button labels
- ARIA attributes where actually necessary
- Keyboard navigation
- Visible focus states
- Form validation messages
- Error states
- Loading states
- Empty states
- Appropriate heading hierarchy
- Color contrast
- Interactive elements
- Screen-reader usability

Do not add unnecessary ARIA attributes when semantic HTML is sufficient.
Run the available accessibility/Lighthouse checks.
Report every issue found.
Then fix the issues without breaking existing functionality or tests.
Finally, run the tests again.



7.
Perform a security-focused audit of the Digital Ticket QR Code Generator Worker.
Focus specifically on:

1. XSS prevention
2. Input sanitization
3. Input validation
4. Unsafe HTML rendering
5. Injection risks
6. Unsafe state handling
7. Sensitive information accidentally exposed in the client
8. API validation
9. Error messages leaking internal implementation details

Do not introduce unnecessary security complexity.
For every issue:
- Explain the risk
- Identify the affected code
- Provide the safest simple fix
Apply the required fixes and run the complete test suite afterward.
Do not remove or weaken tests.



8.
Write the steps to run this project.
[ As my Antigravity account is kept displaying the message => "This account is ineligible for higher rate limits through a Google AI plan at this time.", then I used another AI Tool.]
Important assumptions
Suggested entities/data
