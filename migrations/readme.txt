Migration Guidelines

This guide outlines best practices for writing migration files, including naming conventions, structure, and execution in the project.

Format: YYYYMMDD_HHMMSS_description.dart
Example:
20250305_153000_add_app_mapping.dart
20250305_160500_update_restriction_model.dart

Naming Rules:
Timestamp Prefix: Use the current date and time in YYYYMMDD_HHMMSS format to ensure unique and ordered migrations.
Descriptive Name: Use a concise, lowercase, and snake_case description of the migration's purpose.

Naming Rules:

Timestamp Prefix: Use the current date and time in YYYYMMDD_HHMMSS format to ensure unique and ordered migrations.
Descriptive Name: Use a concise, lowercase, and snake_case description of the migration's purpose.

Starting Prefix (Enum Style): Use one of the following keywords to begin the descriptive name:
add – For adding new fields or features
create – For creating new tables or collections
update – For modifying existing records or structures
delete – For removing specific records or elements
truncate – For clearing entire tables or collections
modify – For altering schema structures (e.g., field types)
rename – For renaming fields or tables
drop – For dropping columns or entire tables
insert – For inserting seed or initial data
migrate – For large-scale transformations or migrations
// add more if needed


NOTION : https://www.notion.so/Migrations-Backend-1c18e6f03e414bda8e243aaacedceeb2
