---
description: Crea git worktree aislado en .trees/<nombre> y ejecuta ahi el requerimiento dado
argument-hint: <descripcion del requerimiento>
---

Requerimiento del usuario: $ARGUMENTS

Pasos a ejecutar en orden:

1. Deriva `<nombre>` en kebab-case corto (2-4 palabras) que resuma el requerimiento arriba. No preguntes al usuario, decide tu.
2. Corre `git status` primero. Si hay cambios sin commit que no son tuyos de esta sesion, avisa antes de continuar.
3. Crea el worktree con rama nueva:
   `git worktree add .trees/<nombre> -b <nombre>`
   Si `.trees/<nombre>` ya existe o la rama ya existe, ajusta el nombre (sufijo -2, -3...) en vez de sobreescribir.
4. Usa EnterWorktree (o cd si no esta disponible) para moverte a `.trees/<nombre>` como directorio de trabajo activo.
5. Ejecuta el requerimiento completo dentro de ese worktree, de forma aislada del codigo en el directorio principal. No toques archivos fuera de `.trees/<nombre>` salvo que el requerimiento lo pida explicitamente.
6. Al terminar, resume que se hizo y en que branch/carpeta quedo, para que el usuario decida cuando mergear o borrar el worktree.
