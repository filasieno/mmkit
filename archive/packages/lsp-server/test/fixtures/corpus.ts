/** Minimal valid Telos frame (from tree-sitter-conceptbase telos corpus). */
export const EMPLOYEE_FRAME = `Employee in EntityType with
  attribute
    name : String
end
`;

/** MSFOL assertion (from assertions corpus). */
export const MSFOL_ASSERTION = `$ forall e/Employee exists n/String (e name n) $
`;

/** Frame with intentional syntax fault (missing end). */
export const BROKEN_FRAME = `Employee in EntityType with
  attribute
    name : String
`;

/** Unicode labels (encoding corpus). */
export const UNICODE_FRAME = `Employee in EntityType with
  attribute
    name : "José";
    city : "São Paulo"
end
`;

/** Simple ECArule (from ecarules corpus). */
export const SIMPLE_ECARULE = `$ n,n1/Integer
ON Tell(In(n,MyInteger))
IF (n < 500)
DO Tell(In(n1,MyInteger)) $
`;

/** Notebook cell 1 — small frame. */
export const NOTEBOOK_CELL_A = `QueryClass AllBosses isA Manager with
     constraint
         all_bosse_srule:
             $ exists e/Employee (e boss this) $
end
`;
