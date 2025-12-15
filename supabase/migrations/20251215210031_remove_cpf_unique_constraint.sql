/*
  # Remove CPF unique constraint

  1. Changes
    - Remove the UNIQUE constraint from the `cpf` column in `user_profiles` table
    - Allow multiple users to register with the same CPF

  2. Rationale
    - Multiple users may share the same CPF for business purposes
    - CPF should not be a unique identifier for user accounts
*/

ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS cpf_unique;
