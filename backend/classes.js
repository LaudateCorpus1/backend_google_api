//classes.js for GAPI backend package, written by Pirjot Atwal
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

/**
 * Parsing used for Data Minimization, only necessary info collected.
 * Drives are folders, thus parent is not collected.
 * @param {JSON} folder Must be a Google File Instane with required attributes
 * @return {JSON} Minimized JSON of folder
 */
function parseFolderInfo(folder) {
    return {
        type: "FOLDER",
        id: folder.id,
        name: folder.name,
        //MoreInfo
    };
}

/**
 * Parsing used for Data Minimization, only necessary info collected.
 * @param {JSON} file Must be a Google File Instance with required attributes
 * @return {JSON} Minimized JSON of file
 */
function parseFileInfo(file) {
    return {
        type: "FILE",
        id: file.id,
        name: file.name,
        parents: file.parents,
        parent: file.parents[0],
        mimeType: file.mimeType
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
     * this.allDriveInfos = All Drive Infos, with this Drive's Info being in position 0
     */
    constructor() {
        this.initializeDriveInfo();
    }

    /**
     * Initializes Manager Info and sets attribute values.
     * @return null
     */
    async initializeDriveInfo() {
        var drives = await gapi.client.drive.drives.list({
            'fields': "*",
        }).then(function (response) {
            return response.result.drives;
        });
        this.allDriveInfos = [];
        for (var drive of drives) {
            this.allDriveInfos.push(parseFolderInfo(drive));
        }
        this.myDriveInfo = parseFolderInfo(await this.retrieveInfo('root'));
        this.allDriveInfos.unshift(this.myDriveInfo);
        this.myDriveID = this.myDriveInfo.id;
        this.driveTrees = [new FolderTree("FOLDER", this.myDriveInfo, new Folder(this.myDriveInfo))];
        this.currentDrive = this.driveTrees[0];
        this.switchDrive(this.myDriveID);
        console.log("MANAGER IS LOADED");
    }

    /**
     * Retrieve Info returns all information provided by drive.files.get call.
     * @param {String} id File or Folder ID
     * @return {JSON} Returns result (GOOGLE FILE INSTANCE)
     */
    async retrieveInfo(id) {
        for (var driveInfo of this.allDriveInfos) {
            if (driveInfo.id == id) {
                return driveInfo;
            }
        }
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
     * A helper function that takes the URL of a Google File and returns
     * its ID. Can be called without a manager instance. 
     * @param {String} URL A URL of a Google File
     */
    static getID(URL) {
        return(new RegExp("\\/d\\/(.*?)(\\/|$)").exec(URL)[1]);
    }

    /**
     * Will retrieve drive if found in driveTrees. 
     * Else, it will attempt to initialize a new FolderTree
     * with that Drive's folder if the ID is valid and add that
     * to driveTrees.
     * @param {String} driveID Google Drive ID for Drive Folder, may exist in this.allDriveInfos
     * @return {FolderTree} tree
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
        if (!info.hasOwnProperty('parents')) {
            this.driveTrees.push(new FolderTree("FOLDER", parseFolderInfo(info), new Folder(driveID)));
            return await this.getDrive(driveID);
        }
    }

    /**
     * This function will switch the current Drive to a Shared Drive
     * or My Drive given a driveID. Will call getDrive, which will
     * attempt to initialize a drive if not found in driveTrees.
     * @param {String} driveID Google Drive ID for Drive Folder, may exist in this.allDriveInfos
     * @return null
     */
    async switchDrive(driveID) {
        if (this.allDriveInfos.map((driveInfo) => driveInfo.id).includes(driveID)) {
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
     * @param {String} id_or_name File ID or Exact Name
     * @param {String} requiredType The requiredtype is either "FOLDER" or "FILE"
     * @return {FolderTree} tree
     */
    find(id_or_name, requiredType = null) {
        return this.currentFolder.get(id_or_name, requiredType);
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
     * NOTE: For prompt, please update the getInput function in 
     * the running Manager Instance (seen below this function).
     * If initAll, will initialize currentDrive to that path.
     * If override, will skip default check through current Drive memory.
     * @param {String} name a File name
     * @param {Boolean} prompt when multiple results show, user will be prompted to choose one.
     * @param {String} customQuery a String that must start with and/or/etc.
     * @param {Boolean} initAll Default=True, Will initialize entire path to file.
     * @param {Boolean} override Default=False, Would skip default check through current driveTrees.
     * @return {FolderTree} Tree, if initAll = true, else a JSON object (GOOGLE FILE INSTANCE)
     */
    async search(name, initAll = true, customQuery = "", prompt = true, override = false) {
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
        if (files.length > 1 && prompt) {
            var index = this.getInput(files);
            files = [files[index]];
        }
        if (files) {
            var myFile = files[0];
            if (initAll) {
                var info = myFile;
                var parentFolder = info.parents[0];
                var sequenceOfParents = [];
                while (!(this.allDriveInfos.map((driveInfo) => driveInfo.id).includes(parentFolder))) {
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
            return genFile(myFile);
        }
    }

    /**
     * To get input through an automated fashion, this function
     * in the Manager instance should be updated to return
     * an integer index for a selection given an array.
     * @param {Array} arr The Files Info Array
     * @return {Integer}
     */
    getInput(arr) {
        if (arr.length > 0) {
            for (var item of arr) {
                console.log(item.name);
            }
            return parseInt(prompt("Provide the index for files. 0 is for the first file."));
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
        return this.currentFolder;
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
        return this.switchLocal(id_or_name, initAll);
    }

    /**
     * cat to make it more familiar feeling for bash users. 
     * Extends getLocal
     * @param {*} name 
     * @param {*} initAll 
     */
    cat(id_or_name) {
        return this.getLocal(id_or_name);
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
    load(listAll = false) {
        this.loadChildFolders(listAll);
        this.loadChildFiles(listAll);
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
    loadChildFiles(listAll = false) {
        this.currentFolder.fillFiles();
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
 * A FolderTree is an array of the following structure:
 * this.root = ["FOLDER" or "FILE", ]
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
        if (this.type == "FOLDER") {
            this.ready = false;
            this.init();
        }
    }

    /**
     * Init makes a call to get all the files of the current folder,
     * parses them, and places them in their corresponding folders.
     * (Either childFileInfo or childFolderInfo)
     * The assumption is that the current drive has atmost 1000 files and folders.
     * Implementation for drive folders that contain more than
     * 1000 files and folders has not been developed.
     * @param {int} pageSize The Default Pagesize to fill the Folder
     */
    async init(pageSize = 1000) { //Page Token TODO
        var response = await gapi.client.drive.files.list({
            'pageSize': pageSize,
            'fields': "*",
            'q': "'" + this.info.id + "' in parents and trashed = false",
            'supportsAllDrives': 'true',
            'includeItemsFromAllDrives': 'true',
        }).then(function (response) {
            return response;
        }, err => console.log("Error ", err));
        var items = response.result.files;
        for (var item of items) {
            if (item.hasOwnProperty('mimeType') && item.mimeType.includes('folder')) {
                this.childFolderInfo.push(parseFolderInfo(item));
            } else if (item.hasOwnProperty('mimeType')) {
                this.childFileInfo.push(parseFileInfo(item));
            }
        }
        this.ready = true;
        return response.result.files;
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
     * Initializes all files in this.fileFolderInfo, adds them to the FolderTree.
     * @param {Integer} pageSize 
     * @return {Array} Returns all File Information
     */
    async fillFiles() {
        var initializedIDs = [];
        for (var item of this.branches) {
            initializedIDs.push(item.info.id);
        }
        for (var info of this.childFileInfo) {
            if (!(initializedIDs.includes(info.id))) {
                this.addBranch("FILE", info, genFile(info));
            }
        }
    }

    /**
     * Calls Fill Folders and Fill Files.
     * Will fill this.childFolderInfo and this.childFileInfo
     * @return null
     */
    async fill() {
        this.fillFolders();
        this.fillFiles();
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
     * @param {String} type "FILE" or "FOLDER" ONLY
     * @param {JSON} info JSON Format
     * @param {Folder or DefaultFile} instance 
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
        if (INSTANCE_OR_ID_OR_NAME == "..") {
            return parent;
        }
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

    /** Creating Files Info:
     * Supported mimeTypes:
     * Folder: "application/vnd.google-apps.folder"
     * Google Doc: "application/vnd.google-apps.document"
     * Spreadsheet: "application/vnd.google-apps.spreadsheet"
     * TODO: Add Slides
     */

    /**
     * Will create a new Folder in this FolderTree and initialize it as a branch.
     * SPECIAL: Bypasses addBranch to avoid an extra quota call.
     * @param {String} name 
     * @return Returns Created FolderTree
     */
    async createFolder(name) {
        payload = {
            "name": name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [this.info.id],
            fields: '*'
        }
        var response = await gapi.client.drive.files.create(payload);
        var parsed = parseFolderInfo(response.result);
        var tree = new FolderTree("FOLDER", parsed, new Folder(parsed), this);
        this.branches.push(tree);
        return tree;
    }

    /** 
     * Will create a File in this FolderTree and initialize it as a branch.
     * FILE_INFO = {
     *  name: "NAME",
     *  mimeType: "application/vnd.google-apps.folder" OR 
     *            "application/vnd.google-apps.document" OR
     *            "application/vnd.google-apps.spreadsheet"
     *            TODO: Add Slides
     * }
     * @param {JSON} FILE_INFO The File Info, must follow above structure.
     * @return {FolderTree} Will return FolderTree for File.
     */
    async createFile(FILE_INFO) {
        if (FILE_INFO.hasOwnProperty('name') && FILE_INFO.hasOwnProperty('mimeType')) {
            FILE_INFO.fields = '*';
            FILE_INFO.parents = [this.info.id];
            var response = await gapi.client.drive.files.create(FILE_INFO);
            var parsed = parseFileInfo(response.result);
            this.childFileInfo.push(parsed);
            return this.addBranch("FILE", parsed, genFile(parsed));
        }
    }


    //TODO: Update Function, Updates given FolderTree Information
    //TODO: Function to list files by certain type, return array.
    //TODO: Shortcut Functionality, grab targetID and initialize as Folder
    //TODO: Move Files
    //TODO: Delete Files
}

class Folder { //Placeholder Class for Drives and Folders
    constructor(info) {
        this.info = info;
    }
}

/**
 * Lazy Evaluation, Child Constructors will perform one
 * call to initialize with their inner content.
 * Each File supports simple read and write capabilities.
 * @param {JSON} info 
 */
function genFile(info) {
    if (info.hasOwnProperty('mimeType') && info.mimeType.includes("spreadsheet")) { //
        return new Sheet(info);
    } else { // Add Google Doc
        return new DefaultFile(info);
    }
}

class DefaultFile {
    constructor(info) {
        this.info = info;
    }
}

/**
 * Google Docs are more complex than they look!
 * View the Reference Docs written here to get an idea:
 * https://developers.google.com/docs/api/concepts/structure
 * 
 * TODO: I'll be implementing a minimalistic style that translates
 * this behavior into a more easily comprehendable and usable
 * structure. (THIS WILL BE MOVED UNTIL THE FEATURE IS
 * DEEMED NECESSARY/WHEN TIME COMES TO DEVELOP IT)
 */
class Doc extends DefaultFile {
    constructor(info) {
        super(info);
        this.init();
    }
    async init() {
        this.content = await this.get();
    }
    async get() {
        var response = await gapi.client.docs.documents.get({
            documentId: this.info.id,
            fields: '*'
        }); //Under Development
    }
    async update() {

    }
}

/**
 * The Sheet class emulates the behavior of Google Sheets,
 * with simple read and write capabilities.
 * Use getRows() in case you are immediately accessing
 * this.rows after initialization.
 */
class Sheet extends DefaultFile {
    constructor(info) {
        super(info);
        this.init();
    }

    async init() {
        this.rows = await this.get();
    }

    async getRows() {
        const delay = (ms = 500) => new Promise(res => setTimeout(res, ms));
        while (this.rows == null) {
            await delay(500);
        }
        return this.rows;
    }

    normalizeRows(rows) {
        if (rows == null) {
            return [];
        }
        var maxLen = 0;
        for (var row of rows) {
            if (row.length > maxLen) {
                maxLen = row.length;
            }
        }
        for (var row of rows) {
            for (var i = maxLen - row.length; i > 0; i--) {
                row.push("");
            }
        }
        return rows;
    }

    async get(subsheet = "") {
        return this.normalizeRows(await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: this.info.id,
            range: subsheet + '!A1:Z',
        }).then(function (response) {
            return response.result.values;
        }));
    }

    async update() {
        return await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: this.info.id,
            range: "A1:Z",
            valueInputOption: "RAW",
        }, {
            values: this.rows
        }).then(function (response) {
            return response;
        }, function (response) {
            console.log('Error Occured: ' + response.result.error.message);
        });
    }
}

//Slides API Under Development


//More APIs on the way!