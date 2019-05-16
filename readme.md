# ECL IDE

    A web-based environment for starting out with ECL.


### Running the Application

This project is containerized via Docker, so `docker-compose up -d` should get you going. Briefly, this command will use an Ubuntu (Bionic / 18.04) image to house both the NodeJS application server, and the ECL client tools. Any ECL that the user writes in their workspace(s) will be compiled and converted to archive XML files that are then submitted to the specified cluster as workunits. Secondly, there is a MySQL (v5.7) image that will serve as the database.

**HOWEVER**, the Dockerfile is going to attempt to copy a `.env` file into the Ubuntu container, which is not present on a fresh checkout of the project. So you should change the name of `.env.sample` to `.env`. You should also provide values for the `DB_ROOT_PASS`, `DB_USER` and `DB_PASS` variables.

Lastly, you will see a `SECRET` variable in the `.env` file. This is used by the authentication system of the IDE to store and compare password hashes of users. You should define a 32 character hex string for this value. The snippet below would be one way to generate such a string, assuming you have NodeJS installed on your host system:

``` node -e "let crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));" ```

---

### TODO

* ~~imports / ecl modules~~

* change datasets/scripts left nav to more closely resemble a file explorer in a texteditor / ide

* import "public" datasets

* user groups
  * invite to group

* ~~sharing workspaces~~

* docker for eclcc?

* wizards for interacting with current output:
  * vertical slice (table)
  * crosstab
  * project / transformation

* records within records from ecl results

* visualizations?