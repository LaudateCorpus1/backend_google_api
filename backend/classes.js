//classes.js for backend package, written by Pirjot Atwal
//To ensure efficient quota usage, these classes will be optimized
//to support lazy evaluation, where values are only computed and
//updated when demanded with past computation being saved by the class.
//It is thus important to initialize class attributes on their first
//need. To better streamline this process, the program will first
//query the current running memory before initializing values.

//When interacting with objects, please retrieve variables
//from current attributes unless an API request is necessary to retrieve
//an updated value. As default, when a Folder is accessed or switched to
//to in the Manager it will automatically populate with MINIMUM Folder information.
//File content should be initialized for at a per-file basis or, if necessary, must be accessed
//by Filling Folder. All file info that has been successfully searched for will 
//be populated in a File's attributes.

//As mentioned above, lazy evaluation requires that interaction
//with content is done at a per-file basis. In cases where automation
//is needed, check that the current attributes are initialized. If not
//ask the corresponding FolderTree to fill its contents. Note, this function's
//use should be extremely limited only to folders with a confirmed low amount
//of files to ensure the script does not slow. As such, folders with more than
//1000 files should not be filled as this operation is currently not
//supported.

function parseDriveInfo(drive) {
    return {
        type: "DRIVE",
        id: drive.id,
        name: drive.name
    };
}

function parseFolderInfo(folder) {
    return {
        type: "FOLDER",
        id: folder.id,
        name: folder.name
        //MoreInfo
    };
}

function parseFileInfo(file) {
    return {
        type: "FILE",
        id: file.id,
        name: file.name
        //MoreInfo
    };
}

class Manager {
    constructor() {
        this.initializeDriveInfo();
    }

    /**
     * Initializes Manager Info and attribute values.
     * Attributes are as follows:
     * TODO
     */
    async initializeDriveInfo() {
        var drives = await gapi.client.drive.drives.list({
            'fields': "*",
        }).then(function (response) {
            return response.result.drives;
        });
        this.sharedDrivesInfo = [];
        for (var drive of drives) {
            this.sharedDrivesInfo.push(parseDriveInfo(drive));
        }
        var info = await gapi.client.drive.files.get({
            'fileId': 'root',
            'fields': '*'
        }).then(function (response) {
            return response.result;
        });
        this.myDriveInfo = {
            id: info.id,
            name: info.name
        }
        this.myDriveID = this.myDriveInfo.id;
        this.driveTrees = [new FolderTree("DRIVE", this.myDriveInfo, new Folder(this.myDriveInfo))];
        this.currentDrive = this.driveTrees[0];
        this.allIDs = [this.myDriveID].concat(this.sharedDrivesInfo.map(drive => drive.id));
        this.switchDrive(this.myDriveID);
    }

    /**
     * Will retrieve drive if found in driveTrees. 
     * Else, it will attempt to initialize a new FolderTree
     * with that Drive's folder if the ID is valid and add that
     * to driveTrees.
     * @param {String} driveID 
     */
    async getDrive(driveID) {
        //Looks in this.driveTrees to find a FolderTree, returns tree
        //If not found will attempt to initialize and add to driveTrees
        for (var tree of this.driveTrees) {
            if (tree.info.id == driveID) {
                return tree;
            }
        }
        if (this.allIDs.includes(driveID)) {
            var info = await gapi.client.drive.drives.get({
                'driveId': driveID,
                'fields': '*',
            }).then(function (response) {
                return response.result;
            });
            this.driveTrees.push(new FolderTree("DRIVE", parseDriveInfo(info), new Folder(driveID)));
            return this.getDrive(driveID);
        }
    }

    /**
     * This function will switch the current Drive to a Shared Drive
     * or My Drive given a driveID. Will call getDrive, which will
     * attempt to initialize a drive if not found in driveTrees.
     * @param {String} driveID 
     */
    async switchDrive(driveID) {
        if (this.allIDs.includes(driveID)) {
            var driveTree = await this.getDrive(driveID);
            this.currentDrive = driveTree;
            this.currentFolder = driveTree;
        } else {
            console.log("That Drive ID was not found.");
        }
    }

    /**
     ----------
     * UNIVERSAL DRIVE METHODS
       Not Dependent on Current Folder
       Dependent on Current Drive
     ---------
     */

    /**
     * Switch to a folder in the currentDrive.
     * If initAbove, will initialize all folders (not fill) 
     * to the path of the given folder.
     * Updates this.currentFolder.
     * @param {String} id_or_name 
     * @param {Boolean} initAbove
     */
    switch (id_or_name, initAbove=false) {
        throw "NOT IMPLEMENTED";
    }

    /**
     * Gets a FolderTree with the given name or id.
     * If initAbove, will initialize all folders (not fill) 
     * to the path of the given folder.
     * @param {String} id_or_name 
     * @param {Boolean} initAbove
     */
    get (id_or_name, initAbove=false) {
        throw "NOT IMPLEMENTED";
    }

    /**
     ---------
     * FULLY UNIVERSAL METHODS
       NOT Dependent on Current Folder or Current Drive
     */

    /**
     * Will universally find the file or folder that corresponds
     * to the provided name or id if the user has access to it.
     * Searches all Drives.
     * Otherwise will return fail.
     * If customQuery, use NAME_OR_ID as chosen query and 
     * return results. (May be multiple)
     * If initAll, will initialize FolderTree to that path.
     * @param {String} NAME_OR_ID
     * @param {String} name 
     */
    async search(NAME_OR_ID, customQuery = false, initAll = false) {
        throw "Not Implemented";
    }

    /**
     ---------
     * Local Methods
       Dependent on Current Folder or Current Drive
     */

    /**
     * Looks at Local Folders in the current Folder and switches if possible.
     * If InitAll, will automatically fill the folder upon opening.
     * Updates this.currentFolder.
     * @param {String} id_or_name 
     * @param {Boolean} initAll 
     */
    async switchLocal(id_or_name, initAll = false) {
        this.currentFolder = await this.currentFolder.getLocal(id_or_name, "FOLDER");
        if(initAll) {
            this.getFolderInfo();
        }
    }

    /**
     * Will retrieve an item if located locally.
     * @param {String} id_or_name 
     */
    async getLocal(id_or_name) {
        return this.currentFolder.getLocal(id_or_name);
    }

    /**
     * cd stands for Change Directory, to make it more familiar feeling
     * for bash users. Extends switchLocal.
     * @param {*} id_or_name 
     * @param {*} initAll 
     */
    cd(id_or_name, initAll=false) {this.switchLocal(id_or_name, initAll);}

    /**
     * cat to make it more familiar feeling for bash users. 
     * Extends getLocal
     * @param {*} name 
     * @param {*} initAll 
     */
    cat(id_or_name) { getLocal(id_or_name); }

    /**
     * Retrieves and Logs Information of currentDrive.
     */
    getInfo() {
        throw "Not Implemented";
    }

    /**
     * Retrieves and Logs Information of currentFolder.
     */
    getFolderInfo() {
        throw "Not Implemented";
    }

    /**
     * Will initialize all child files and folders in current folder.
     * @param {Boolean} listAll
     * @param {Integer} pageSize 
     */
    load(listAll = false, pageSize = 100) {
        this.loadChildFolders(listAll);
        this.loadChildFiles(listAll, pageSize);
        if (listAll) {
            this.getFolderInfo();
        }
    }

    /**
     * Will initialize all child folders in current folder.
     * @param {Boolean} listAll 
     * @param {Integer} pageSize 
     */
    loadChildFolders(listAll = false) {
        this.currentDrive.get(this.currentFolder.info.id).fillFolders();
        if (listAll) {
            this.getFolderInfo();
        }
    }

    /**
     * Will initialize all child files in current folder.
     * @param {Boolean} listAll 
     * @param {Integer} pageSize 
     */
    loadChildFiles(listAll = false, pageSize = 100) {
        this.currentDrive.get(this.currentFolder.info.id).fillFiles(pageSize);
        if (listAll) {
            this.getFolderInfo();
        }
    }

    /**
     * NOTE: Any other "Switching" or manual editing should be done by populating
     * the corresponding foldertree manually. Recursion is recommended for 
     * large automation tasks. Examples shown in the following FolderTree class.
     */
}

/**
 * A FolderTree is an array of the following structure.
 * TOBEUPDATED
 * [
 *  [["DRIVE", INFO, INSTANCE], [["FOLDER", INFO, INSTANCE], [["FOLDER", INFO, INSTANCE], ...], [["FILE", INFO, INSTANCE]]], [["FOLDER", INFO, INSTANCE]], [["FILE", INFO, INSTANCE]]
 * ]
 */
class FolderTree {
    /**
     * The FolderTree, a system which supports lazy evaluation and tracks
     * the information currently accessed in a Google Drive or Folder.
     * Has three types, and supports multiple functions.
     * @param {*} type 
     * @param {*} info 
     * @param {*} instance 
     * @param {*} parent 
     * TODO: FolderInfo pagesize parameter.
     */
    constructor(type, info, instance, parent = null) {
        this.type = type;
        this.info = info;
        this.instance = instance;
        this.root = [this.type, this.info, this.instance];
        this.branches = [];
        this.childFolderInfo = [];
        this.childFileInfo = [];
        this.foldersInitialized = false;
        //If type is DRIVE, parent should be null
        this.parent = parent;
        if (this.type == "DRIVE" || this.type == "FOLDER") {
            this.initFolderInfo();
        }
    }

    /**
     * Fills this.childFolderInfo with the info of all folders that
     * are a child of this FolderTree.
     * @param {Integer} pageSize 
     * @return {Array} Returns all File Information fields=*
     */
    async initFolderInfo(pageSize=100) {
        //Fills this.childFolderInfo with all of my folders info
        //Should be called in constructor
        var response = await gapi.client.drive.files.list({
            'pageSize': pageSize,
            'fields': "*",
            'q': "'" + this.info.id + "' in parents and mimeType contains 'folder' and trashed = false",
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        console.log("Folder " + this.info.id + " was just filled Folders:");
        console.log(response.result);
        this.childFolderInfo = this.childFolderInfo.concat(response.result.files.map(folder => parseFolderInfo(folder)));
        return response.result.files;
    }

    /**
     * Initializes as many files as possible, adds them to the FolderTree.
     * @param {*} pageSize 
     * @return {Array} Returns all File Information
     */
    async fillFiles(pageSize = 500) {//Page Token TODO
        var response = await gapi.client.drive.files.list({
            'pageSize': pageSize,
            'fields': "*",
            'q': "'" + this.folderID + "' in parents and not mimeType contains 'folder' and trashed = false",
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        console.log("Folder " + this.info.id + " was just filled:");
        console.log(response.result);
        for (var file of response.result.files) {
            var parsed = parseFileInfo(file);
            if (!(parsed in this.childFileInfo)) {
                this.childFileInfo.push(parsed);
                this.addBranch("FILE", parsed, new File(parsed));
            }
        }
        return response.result.files;
    }

    /**
     * Will initialize all folders found in childFolderInfo.
     * Is created for "One Time Use", will not add more folders when initialized.
     */
    async fillFolders() {
        if (!this.foldersInitialized) {
            for (var info of this.childFolderInfo) {
                this.addBranch("FOLDER", info, new Folder(info));
            }
            this.foldersInitialized = true;
        }
    }

    /**
     * Will initialize targeted folder by ID.
     * Will not initialize folder if already initialized.
     * @param {String} id 
     * @return {FolderTree} if not initialized already.
     * TODO: else, return foldertree that was initialized.
     */
    async initFolder(id) {
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        if (!(id in initializedIDs)) {
            for (var info of this.childFolderInfo) {
                if (id == info.id) {
                    return await this.addBranch("FOLDER", info, new Folder(info));
                }
            }
        }
    }

    /**
     * Will initialize targeted file by ID.
     * Will not initialize file if already initialized.
     * @param {String} id 
     * @return {FolderTree} if not initialized already.
     * TODO: else, return foldertree that was initialized.
     */
    async initFile(id) {
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        if (!(id in initializedIDs)) {
            for (var info of this.childFileInfo) {
                if (id == info.id) {
                    return await this.addBranch("FILE", info, new File(info));
                }
            }
        }
    }

    /**
     * Main function to add branch to this.branches.
     * Checks for types, creates FolderTree and returns FolderTree.
     * @param {*} type 
     * @param {*} info 
     * @param {*} instance 
     */
    async addBranch(type, info, instance) {
        type = type.toUpperCase();
        if (this.type != "FILE" && (type == "DRIVE" || type == "FOLDER" || type == "FILE")) {
            var tree = new FolderTree(type, info, instance, this);
            this.branches.push(tree);
            return tree;
        } else if (this.type == "FILE") {
            throw "You can not add a branch to a FILE FolderTree.";
        } else {
            throw "Type must be DRIVE, FOLDER, or FILE.";
        }
    }

    /**
     * Returns branch that matches given parameter.
     * @param {String} id 
     * @return {FolderTree} returns branch or null
     */
    getBranch(INSTANCE_OR_ID_OR_NAME) {
        for (var branch of this.branches) {
            if (branch.info.id == INSTANCE_OR_ID_OR_NAME || branch.info.name == INSTANCE_OR_ID_OR_NAME || branch.instance == INSTANCE_OR_ID_OR_NAME) {
                return branch;
            }
        }
        return null;
    }

    /**
     * Searches entire FolderTree for match. If match can be initialized
     * and added, the function will do so. Judges initialization
     * based on childFolderInfo or childFileInfo.
     * Returns the FolderTree that matches the parameter.
     * @param {String} INSTANCE_OR_ID_OR_NAME 
     * @param {String} requiredType, "DRIVE"/"FOLDER"/"FILE"
     * @return {FolderTree}
     */
    get(INSTANCE_OR_ID_OR_NAME, requiredType=null) {
        var topParent = this;
        while (topParent.parent) {
            topParent = topParent.parent;
        }
        return topParent.getNested(INSTANCE_OR_ID_OR_NAME, requiredType);
    }

    /**
     * Searches local branches for match. If match can be initialized
     * and added, the function will do so. Judges initialization
     * based on childFolderInfo or childFileInfo.
     * Returns the FolderTree that matches the parameter.
     * @param {String} INSTANCE_OR_ID_OR_NAME 
     * @param {String} requiredType 
     * @return {FolderTree}
     */
    getLocal(INSTANCE_OR_ID_OR_NAME, requiredType=null) {
        for (var branch of this.branches) {
            if (branch.info.id == INSTANCE_OR_ID_OR_NAME || branch.info.name == INSTANCE_OR_ID_OR_NAME || branch.instance == INSTANCE_OR_ID_OR_NAME) {
                if (!requiredType || branch.type == requiredType) {
                    return branch;
                }
            }
        }
        for (var info of this.childFolderInfo) {
            if (info.id == INSTANCE_OR_ID_OR_NAME || info.name == INSTANCE_OR_ID_OR_NAME) {
                if (!requiredType || info.type == requiredType) {
                    return this.initFolder(info.id);
                }
            }
        }
        for (var info of this.childFileInfo) {
            if (info.id == INSTANCE_OR_ID_OR_NAME || info.name == INSTANCE_OR_ID_OR_NAME) {
                if (!requiredType || info.type == requiredType) {
                    return this.initFile(info.id);
                }
            }
        }
        return null;
    }

    /**
     * Searches down for match. If match can be initialized
     * and added, the function will do so. Judges initialization
     * based on childFolderInfo or childFileInfo.
     * Returns the FolderTree that matches the parameter.
     * @param {String} INSTANCE_OR_ID_OR_NAME 
     * @param {String} requiredType 
     * @return {FolderTree}
     */
    getNested(INSTANCE_OR_ID_OR_NAME, requiredType=null) {
        //this.type must be DRIVE or FOLDER.
        //Searches Downward
        var find = this.getLocal(INSTANCE_OR_ID_OR_NAME, requiredType);
        if (find) {
            return find;
        }
        for (var branch of this.branches) {
            var searchLower = branch.getNested(INSTANCE_OR_ID_OR_NAME, requiredType);
            if (searchLower) {
                return searchLower;
            }
        }
        return null;
    }

    getSibling(INSTANCE_OR_ID_OR_NAME) {
        //Search Parent's Branches
        if (parent) {
            return parent.getBranch(INSTANCE_OR_ID_OR_NAME);
        }
        return null;
    }

    //TODO: Update Function, Updates given FolderTree Information
}

class Folder { //Placeholder Class
    constructor(info) {
        this.info = info;
    }
}


//Lazy Evaluation, Constructor will not initialize with content,
//Requested On Demand (Translation to other APIs begins here)
class File {
    constructor(info) {
        this.info = info;
    }
}