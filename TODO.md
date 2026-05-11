- ADD some info (probably footer) about me and my info (maybe web page), and the source of the firesport.eu data

- FIXES
    - on headers make the sorting work when i click anywhere on the header, not just on the text
    - when hovering cells that can be used for filtering, show more saturated color

-ADD user identification
    - register, sign in, log out (maybe with google if possible)
    - probably having some table of users with their permissions, password hash and maybe some other info like email, name, etc.
    - permissions will be admin, user, but also some more specific like - can edit the league excr, or something

- Add some graphs - Reacharts library?
    - thinking of bar chart with number of attacks in some tiers ( 0 - 15, 15 - 16, 16 - 17, 17 - 18, 19 +)

- Create filter presets - this will allow users to save their filter combinations and load them later - these filters will be owned by the user, so they will be able to create, edit and delete them. This will require some backend work to save the presets in the database and associate them with the user.

- MAYBE MAYBE MAYBE
    - Add a part for asking some llm for doing some specific query for the database and running it
