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
        name: file.name,
        parents: file.parents,
        parent: file.parents[0]
        //MoreInfo
    };
}

class Manager {
    /**
     * Attributes are as follows:
     * this.myDriveInfo = JSON Object with ID and Name for Drive.
     * this.myDriveID = This Drive's ID as a String
     * this.driveTrees = An Array holding all root Drivetrees
     * this.currentDrive = Which drive the manager is "in" currently
     * this.currentFolder = Which folder the manager is "in" currently
     * this.allIDs = All Drive IDs, with this Drive's ID being in position 0
     */
    constructor() {
        this.initializeDriveInfo();
    }

    /**
     * Initializes Manager Info and attribute values.
     */
    async initializeDriveInfo() {
        var drives = await gapi.client.drive.drives.list({
            'fields': "*",
        }).then(function (response) {
            return response.result.drives;
        });
        this.sharedDrivesInfo = [];
        for (var drive of drives) {
            var driveInfo = await this.retrieveInfo(drive.id);
            this.sharedDrivesInfo.push(parseFolderInfo(driveInfo));
        }
        this.myDriveInfo = parseFolderInfo(await this.retrieveInfo('root'));
        this.myDriveID = this.myDriveInfo.id;
        this.driveTrees = [new FolderTree("DRIVE", this.myDriveInfo, new Folder(this.myDriveInfo))];
        this.currentDrive = this.driveTrees[0];
        this.allIDs = [this.myDriveID].concat(this.sharedDrivesInfo.map(drive => drive.id));
        this.switchDrive(this.myDriveID);
        console.log("MANAGER IS LOADED")
    }

    async retrieveInfo(id) {
        return await gapi.client.drive.files.get({
            'fileId': id,
            'fields': '*',
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true'
        }).then(function (response) {
            return response.result;
        }, err => console.log("Error ", err));
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
        var info = await this.retrieveInfo(driveID);
        if (this.allIDs.includes(driveID) || !info.hasOwnProperty('parents')) {
            this.driveTrees.push(new FolderTree("DRIVE", parseFolderInfo(info), new Folder(driveID)));
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
            var drive = await this.getDrive(driveID);
            this.currentDrive = drive;
            this.currentFolder = drive;
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
     * Returns folder or file in the currentDrive.
     * Folder or file must exist in currentDrive already.
     * Possible use, updating manager.currentFolder
     * @param {String} id_or_name 
     * @param {Boolean} initAbove
     */
    find(id_or_name, requiredType = null) {
        this.currentFolder.get(id_or_name, requiredType);
    }

    /**
     ---------
     * FULLY UNIVERSAL METHODS
       NOT Dependent on Current Folder or Current Drive
     */

    /**
     * Will universally find the file or folder that corresponds
     * to the provided name if the user has access to it.
     * Searches all Drives.
     * customQuery can be set to add on to the query.
     * Documentation for Search Queries can be found online.
     * If prompt, when multiple results show, user will prompted to choose one.
     * NOTE: For prompt, please updated the getInput function in 
     * the running Manager Instance (seen below this function).
     * If initAll, will initialize currentDrive to that path.
     * If override, will skip default check through current Drive memory.
     * @param {String} name a File name
     * @param {Boolean} prompt when multiple results show, user will be prompted to choose one.
     * @param {String} customQuery a String that must start with and/or/etc.
     * @param {Boolean} initAll Default=True, Will initialize entire path to file.
     * @param {Boolean} override Default=False, Would skip default check through current driveTrees.
     * @return {FolderTree or JSON} Tree, if initAll = true, else a JSON object
     */
    async search(name, prompt = false, customQuery = "", initAll = true, override = false) {
        //Check every existing drive first.
        if (!override) {
            for (var drive of this.driveTrees) {
                var find = drive.get(name);
                if (find) {
                    return find;
                }
            }
        }
        //Perform Query
        var response = await gapi.client.drive.files.list({
            'pageSize': 1000,
            'fields': "*",
            'q': "name contains '" + name + "' and trashed = false " + customQuery,
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        var files = response.result.files;
        console.log(files);
        if (files.length > 1 && prompt) {
            var index = parseInt(this.getInput(files));
            files = [files[index]];
        }
        if (files) {
            var myFile = files[0];
            if (initAll) {
                var info = myFile;
                var parentFolder = info.parents[0];
                var sequenceOfParents = [];
                while (!(this.allIDs.includes(parentFolder))) {
                    info = await this.retrieveInfo(parentFolder);
                    sequenceOfParents.push(info.id);
                    if (!info.hasOwnProperty('parents')) {
                        break;
                    }
                    parentFolder = info.parents[0];
                }
                var folder = await this.getDrive(parentFolder);
                var check = folder.info.id;
                var target = sequenceOfParents[0];
                while (check != target) {
                    var nextID = sequenceOfParents.pop();
                    folder = await folder.initFolder(nextID);
                    check = folder.info.id;
                }
                if (myFile.mimeType.includes("folder")) {
                    var endFolder = await folder.initFolder(myFile.id);
                    return endFolder;
                } else {
                    return await folder.searchAndInit(myFile.id);
                }
            }
            return null;
        }
    }

    /**
     * To get input through an automated fashion, this function
     * in the Manager instance should be updated to return
     * an integer index for a selection given an array.
     * @param {Array} arr The Files Array
     * @return {String}
     */
    getInput(arr) {
        if (arr.length > 0) {
            for (var item of arr) {
                console.log(item.name);
            }
            return prompt("Provide the index for files.");
        }
    }

    /**
     ---------
     * Local Methods
       Dependent on Current Folder and Current Drive
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
        if (initAll) {
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
    cd(id_or_name, initAll = false) {
        this.switchLocal(id_or_name, initAll);
    }

    /**
     * cat to make it more familiar feeling for bash users. 
     * Extends getLocal
     * @param {*} name 
     * @param {*} initAll 
     */
    cat(id_or_name) {
        this.getLocal(id_or_name);
    }

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
        this.currentFolder.fillFolders();
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
        this.currentFolder.fillFiles(pageSize);
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
     * @param {String} type 
     * @param {JSON} info 
     * @param {File or Folder} instance 
     * @param {FolderTree or null} parent 
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
        //If type is DRIVE, parent should be null
        this.parent = parent;
        this.ready = true;
        if (this.type == "DRIVE" || this.type == "FOLDER") {
            this.ready = false;
            this.initFolderInfo();
        }
    }

    /**
     * Fills this.childFolderInfo with the info of all folders that
     * are a child of this FolderTree.
     * @param {Integer} pageSize 
     * @return {Array} Returns all File Information fields=*
     */
    async initFolderInfo(pageSize = 100) {
        //Fills this.childFolderInfo with all of my folders info
        //Should be called in constructor
        //Alternatively could use gapi's Children list function
        var response = await gapi.client.drive.files.list({
            'pageSize': pageSize,
            'fields': "*",
            'q': "'" + this.info.id + "' in parents and mimeType contains 'folder' and trashed = false",
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        this.childFolderInfo = this.childFolderInfo.concat(response.result.files.map(folder => parseFolderInfo(folder)));
        this.ready = true;
        return response.result.files;
    }

    /**
     * Initializes as many files as possible, adds them to the FolderTree.
     * @param {Integer} pageSize 
     * @return {Array} Returns all File Information
     */
    async fillFiles(pageSize = 1000) { //Page Token TODO
        //Alternatively could use gapi's Children list function
        var response = await gapi.client.drive.files.list({
            'pageSize': pageSize,
            'fields': "*",
            'q': "'" + this.info.id + "' in parents and not mimeType contains 'folder' and trashed = false",
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        for (var file of response.result.files) {
            var parsed = parseFileInfo(file);
            if (!(this.childFileInfo.includes(parsed))) {
                this.childFileInfo.push(parsed);
                this.addBranch("FILE", parsed, genFile(parsed));
            }
        }
        return null;
    }

    /**
     * Will search for a file (doesn't have to exist in this.childFileInfo)
     * and initialize it. (Adding it ot this.childFileInfo)
     * @param {String} id file id
     */
    async searchAndInit(id) {
        //File ID must exist (must be searched beforehand) and must be a child of this 
        //folder
        var response = await gapi.client.drive.files.get({
            'fileId': id,
            'fields': '*',
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true'
        }).then(function (response) {
            return response.result;
        }, err => console.log("Error ", err));
        var parsed = parseFileInfo(response);
        if (!(this.childFileInfo.includes(parsed)) && parsed.parent == this.info.id) {
            this.childFileInfo.push(parsed);
            return this.addBranch("FILE", parsed, genFile(parsed));
        }
        return null;
    }

    /**
     * Will initialize all folders found in childFolderInfo.
     * Is created for "One Time Use", will not add more folders when initialized.
     */
    async fillFolders() {
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        for (var info of this.childFolderInfo) {
            if (!(initializedIDs.includes(info.id))) {
                this.addBranch("FOLDER", info, new Folder(info));
            }
        }
    }

    /**
     * Will initialize targeted folder by ID or Name.
     * Will not initialize folder if already initialized.
     * @param {String} id_or_name
     * @return {FolderTree} if not initialized already.
     * TODO: else, return foldertree that was already initialized.
     */
    async initFolder(id_or_name) {
        const delay = (ms = 500) => new Promise(res => setTimeout(res, ms));
        while (!this.ready) {
            await delay(500);
            //console.log("Waited .5 sec ", this.ready);
        }
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        if (!(initializedIDs.includes(id_or_name))) {
            for (var info of this.childFolderInfo) {
                if (id_or_name == info.id || id_or_name == info.name) {
                    console.log(info, id_or_name);
                    return await this.addBranch("FOLDER", info, new Folder(info));
                }
            }
        }
    }

    /**
     * Will initialize targeted file by ID or Name.
     * Will not initialize file if already initialized.
     * @param {String} id_or_name
     * @return {FolderTree} tree, if not initialized already.
     * @comment TODO: else, return foldertree that was already initialized.
     */
    async initFile(id_or_name) {
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        if (!(initializedIDs.includes(id_or_name))) {
            for (var info of this.childFileInfo) {
                if (id_or_name == info.id || id_or_name == info.name) {
                    return await this.addBranch("FILE", info, genFile(info));
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
        if (this.type != "FILE" && (type == "FOLDER" || type == "FILE")) {
            var tree = new FolderTree(type, info, instance, this);
            this.branches.push(tree);
            return tree;
        } else if (this.type == "FILE") {
            throw "You can not add a branch to a FILE FolderTree.";
        } else {
            throw "Type must be FOLDER or FILE.";
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
     * @param {String} requiredType, "FOLDER"/"FILE"
     * @return {FolderTree}
     */
    get(INSTANCE_OR_ID_OR_NAME, requiredType = null) {
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
    getLocal(INSTANCE_OR_ID_OR_NAME, requiredType = null) {
        if (this.info.id == INSTANCE_OR_ID_OR_NAME || this.info.name == INSTANCE_OR_ID_OR_NAME || this.instance == INSTANCE_OR_ID_OR_NAME) {
            if (!requiredType || this.type == requiredType) {
                return this;
            }
        }
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
    getNested(INSTANCE_OR_ID_OR_NAME, requiredType = null) {
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

class Folder { //Placeholder Class for Drives and Folders
    constructor(info) {
        this.info = info;
    }
}


//Lazy Evaluation, Child Constructors will not initialize with content,
//Requested On Demand (Translation to other APIs begins here)
function genFile(info) {
    if (info.hasOwnProperty('mimetype') && info.mimetype == "SHEET") {
        return new Sheet(info);
    } else {
        return new DefaultFile(info);
    }
}

class DefaultFile {
    constructor(info) {
        this.info = info;
    }
}

class Sheet extends DefaultFile {
    constructor(info) {
        super(info);
    }
}