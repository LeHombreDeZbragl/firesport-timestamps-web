- ADD new column for editing - it will be a pencil icon, when you click on it, the row will become editable and you can change the values in the cells, then you can click on a save button to save the changes (or a cancel button to discard them). This will require some backend work to update the database with the new values.

-ADD user identification
    - register, sign in, log out (maybe with google if possible)
    - probably having some table of users with their permissions, password hash and maybe some other info like email, name, etc.
    - permissions will be admin, user, but also some more specific like - can edit the league excr, or something

- Add some graphs - Reacharts library?
    - thinking of bar chart with number of attacks in some tiers ( 0 - 15, 15 - 16, 16 - 17, 17 - 18, 19 +)

- Create filter presets - this will allow users to save their filter combinations and load them later - these filters will be owned by the user, so they will be able to create, edit and delete them. This will require some backend work to save the presets in the database and associate them with the user.

- MAYBE MAYBE MAYBE
    - Add a part for asking some llm for doing some specific query for the database and running it
