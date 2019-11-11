# ECL IDE

    A web-based environment for starting out with ECL.

### RE: Git LFS
Just a note regarding this project's usage of Git Large File Storage (LFS) for tracking
binary assets. At the time of writing, this only includes some .webm videos used in the
"Feature Tour" item under the application's "Help" menu & a local copy of the ECL
Cheatsheet PDF (https://github.com/hpcc-systems/HPCC-ECL-Training/tree/master/CheatSheet).
But initialization of a fork of this project would include having LFS installed during
checkout, otherwise you wouldn't get these and any future larger binary assets.

### Running the Application

This project is containerized via Docker, so `docker-compose up -d` should get you going.
Briefly, this command will use an Ubuntu (Bionic / 18.04) image to house both the NodeJS
application server, and the ECL client tools. Any ECL that the user writes in their workspace(s)
will be compiled and converted to archive XML files that are then submitted to the specified
cluster as workunits. Secondly, there is a MySQL (v5.7) image that will serve as the database.

**HOWEVER**, the Dockerfile is going to attempt to copy a `.env` file into the Ubuntu
container, which is not present on a fresh checkout of the project. So you should change
the name of `.env.sample` to `.env`. You should also provide values for the `DB_ROOT_PASS`,
`DB_USER` and `DB_PASS` variables defined in this file.

Lastly, you will see a `SECRET` variable in the `.env` file. This value will be used by
the authentication system of the IDE to generate the password hashes of users. You should
define a 32 character hex string for this value. The snippet below would be one way to
generate such a string, assuming you have NodeJS installed on your host system:

``` node -e "let crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));" ```

The application should be run with TLS, and by default this project assumes that will be
handled outside of the application layer, e.g. via an AWS elastic load balancer. This
could perhaps be changed to have the TLS configured at the nginx reverse proxy level; if so,
the `./nginx/Dockerfile` should be modified accordingly.
