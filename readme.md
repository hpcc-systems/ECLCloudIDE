# ECL IDE

    A web-based environment for starting out with ECL.


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

---

### TODO

* ~~imports / ecl modules~~

* ~~user functions~~
  * ~~change password~~
  * ~~forgot password~~

* user cluster management
  * account page for managing clusters
  * connecting to clusters with authentication
  * should this affect the new workspace dialog - cluster field to be a combobox instead of simple text input

* implement password lockout?

* uploading datasets
  * ~~CSV~~
  * JSON
  * XML

* importing datasets from:
  * https://data.gov

* importing workspaces (ECL) from git repositories
  * would it be possible to create a workspace definition file that references datasets?

* exporting workspaces (ECL) to a git repository?

* ~~dockerize a reverse proxy in front of the node app~~

* ~~user groups~~ _user groups probably aren't going to be a thing_
  * ~~create a group~~
  * ~~invite a user to a group~~
  * ~~list groups user belongs to~~
  * ~~leave group~~
  * ~~remove from group~~

* ~~security concern - change to docker file of node app to not run the container as root~~

* ~~make mail configurable, based on env (nodemailer for dev, aws-sdk for prod?)~~

* add a help menu, linking to:
  * ~~ecl docs~~
  * some sort of feedback form?
  * ~~maybe one of those DOM-highlighty feature tours~~

* ~~install supported ECL bundles (should occur during container creation)~~

* ~~rendering DataPatterns report (custom WU "Resources" tab content from ECLWatch?)~~

* ~~use DataPatterns (best_attribute_type) to determine THOR schema~~

* ~~sharing workspaces~~
  * ~~share with a user~~ _both of these methods (user & group) replaced by url_
  * ~~share with a group~~
  * ~~generate a url to share a workspace, rather than specifically assigning to users / groups~~

* ~~change datasets/scripts left nav to more closely resemble a file explorer in a text-editor / ide~~

* ~~docker for eclcc?~~ _not really necessary, eclcc is just installed in the web app server_

* "wizards" for interacting with current output:
  * vertical slice (table)
  * crosstab
  * project / transformation

* records within records from ecl results

* ~~visualizations?~~ _user can import the Visualizer bundle, the app will show the resulting html/js assets for the workunit_