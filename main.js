import * as THREE from 'three';
import Stats from 'stats.js';

// 第三人称相机类
class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;
        
        // 相机配置
        this.config = {
            distance: 80,          // 相机距离目标的距离
            minDistance: 30,       // 最小距离
            maxDistance: 150,      // 最大距离
            height: 40,            // 相机高度偏移
            rotationSpeed: 0.05,   // 旋转速度
            followSpeed: 0.1,      // 跟随速度
            lookAtSpeed: 0.1,      // 看向目标的速度
            mouseSensitivity: 0.003, // 鼠标敏感度
            dampingFactor: 0.35,   // 阻尼因子
            minPolarAngle: 0.1,    // 最小极角
            maxPolarAngle: Math.PI - 0.1 // 最大极角
        };
        
        // 相机状态
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        // 鼠标控制
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.isMouseDown = false;
        
        // 相机位置和目标
        this.currentTarget = new THREE.Vector3();
        this.currentPosition = new THREE.Vector3();
        this.desiredPosition = new THREE.Vector3();
        
        // 抖动偏移
        this.shakeOffset = null;
        
        // 初始化
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        // 设置初始球坐标
        this.spherical.setFromVector3(this.camera.position.clone().sub(this.target.position));
        this.spherical.radius = this.config.distance;
        
        // 设置初始位置
        this.currentTarget.copy(this.target.position);
        this.currentPosition.copy(this.camera.position);
        
        // 确保相机朝向目标
        this.camera.lookAt(this.target.position);
    }
    
    setupEventListeners() {
        // 鼠标事件
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // 滚轮事件
        document.addEventListener('wheel', this.onWheel.bind(this));
        
        // 右键菜单禁用
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    onMouseDown(event) {
        if (event.button === 0 || event.button === 2) { // 左键或右键
            this.isMouseDown = true;
            this.mouseDownX = event.clientX;
            this.mouseDownY = event.clientY;
        }
    }
    
    onMouseMove(event) {
        if (!this.isMouseDown) return;
        
        const deltaX = event.clientX - this.mouseDownX;
        const deltaY = event.clientY - this.mouseDownY;
        
        // 更新球坐标
        this.sphericalDelta.theta = -deltaX * this.config.mouseSensitivity;
        this.sphericalDelta.phi = -deltaY * this.config.mouseSensitivity;
        
        this.mouseDownX = event.clientX;
        this.mouseDownY = event.clientY;
    }
    
    onMouseUp(event) {
        if (event.button === 0 || event.button === 2) {
            this.isMouseDown = false;
        }
    }
    
    onWheel(event) {
        const delta = event.deltaY * 0.01;
        this.config.distance += delta * this.config.distance * 0.1;
        this.config.distance = Math.max(
            this.config.minDistance,
            Math.min(this.config.maxDistance, this.config.distance)
        );
    }
    
    update() {
        // 应用鼠标输入
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // 限制极角
        this.spherical.phi = Math.max(
            this.config.minPolarAngle,
            Math.min(this.config.maxPolarAngle, this.spherical.phi)
        );
        
        // 更新半径
        this.spherical.radius = this.config.distance;
        
        // 应用阻尼
        this.sphericalDelta.theta *= this.config.dampingFactor;
        this.sphericalDelta.phi *= this.config.dampingFactor;
        
        // 平滑跟随目标
        this.currentTarget.lerp(this.target.position, this.config.followSpeed);
        
        // 计算期望的相机位置
        this.desiredPosition.setFromSpherical(this.spherical);
        this.desiredPosition.add(this.currentTarget);
        
        // 平滑移动相机
        this.currentPosition.lerp(this.desiredPosition, this.config.followSpeed);
        
        // 应用抖动偏移
        const finalPosition = this.currentPosition.clone();
        if (this.shakeOffset) {
            finalPosition.add(this.shakeOffset);
        }
        
        this.camera.position.copy(finalPosition);
        
        // 平滑朝向目标
        const lookAtTarget = this.currentTarget.clone();
        lookAtTarget.y += this.config.height * 0.1; // 稍微向上偏移视线
        this.camera.lookAt(lookAtTarget);
    }
    
    // 设置目标
    setTarget(target) {
        this.target = target;
    }
    
    // 重置相机
    reset() {
        this.spherical.set(this.config.distance, Math.PI / 3, 0);
        this.sphericalDelta.set(0, 0, 0);
        this.currentTarget.copy(this.target.position);
    }
    
    // 获取相机前方向量
    getForwardVector() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }
    
    // 获取相机右方向量
    getRightVector() {
        return new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    }
}

class SnakeGame {
    constructor() {
        // 游戏配置
        this.GRID_SIZE = 10;
        this.BOARD_SIZE = 30;
        this.GAME_SPEED = 50; // 毫秒
        this.TURN_SPEED = 0.16; // 增加转弯速度让移动更平滑
        this.SMOOTH_FACTOR = 0.6; // 平滑移动因子
        
        // 难度控制配置
        this.DIFFICULTY_CONFIG = {
            baseSpeed: 10.5,           // 基础移动速度
            initialLength: 3,          // 初始蛇长度
            maxSpeed: 25.0,            // 最大移动速度
            linearGrowth: 0.8,         // 线性增长系数
            exponentialGrowth: 1.05,   // 指数增长系数
            logGrowth: 2.0,            // 对数增长系数
            speedIncreaseThreshold: 5, // 每增长多少长度显著提升速度
            // 新增动态平衡参数
            dynamicFactor: 0.6,        // 动态调节系数
            minSafeLength: 8,          // 安全长度阈值
            recoveryRate: 0.15,        // 恢复速率
            maxRecoveryTime: 15000,    // 最大恢复时间(毫秒)
            comboMultiplier: 1.2,      // 连击倍数
            safetyBuffDuration: 3000   // 安全期持续时间
        };
        
        // 蛇身体缩放比例
        this.SNAKE_SCALE_START = 1.5;    // 蛇身体起始缩放比例
        this.SNAKE_SCALE_END = 0.2;    // 蛇身体末端缩放比例
        
        // 障碍物系统
        this.obstacles = [];              // 障碍物数组
        this.obstacleGeometry = null;     // 障碍物几何体
        this.obstacleMaterial = null;     // 障碍物材质
        this.nextObstacleTime = 0;        // 下一个障碍物生成时间
        this.obstacleMinInterval = 8000;  // 最小生成间隔（毫秒）
        this.obstacleMaxInterval = 15000; // 最大生成间隔（毫秒）
        this.maxObstacles = 5;            // 最大障碍物数量
        this.obstacleTextMaterial = null; // 障碍物文本材质
        
        // 新增障碍物类型系统 - 儿童友好色彩
        this.obstacleTypes = {
            WEAK: { color: 0x98FB98, emissive: 0x004400, geometry: 'box', effect: 'stun' }, // 淡绿色，温和
            NORMAL: { color: 0xFFE135, emissive: 0x664400, geometry: 'octahedron', effect: 'shrink' }, // 明亮黄色，阳光感
            STRONG: { color: 0xFF6B6B, emissive: 0x440000, geometry: 'tetrahedron', effect: 'halve' }, // 温暖红色，不太刺眼
            SPECIAL: { color: 0x74C0FC, emissive: 0x004466, geometry: 'sphere', effect: 'teleport' } // 天蓝色，梦幻感
        };
        
        // 相机抖动和眩晕效果
        this.cameraShake = {
            isShaking: false,
            intensity: 0,
            duration: 0,
            elapsed: 0
        };
        this.snakeStunned = {
            isStunned: false,
            duration: 0,
            elapsed: 0,
            originalSpeed: 0
        };
        
        // 游戏状态
        this.gameState = 'waiting'; // 'waiting', 'playing', 'paused', 'gameOver'
        this.score = 0;
        
        // 新增游戏状态变量
        this.gameStartTime = 0;        // 游戏开始时间
        this.survivalTime = 0;         // 存活时间
        this.comboCount = 0;           // 连击计数
        this.lastFoodTime = 0;         // 上次吃食物时间
        this.isInvulnerable = false;   // 无敌状态
        this.invulnerableEndTime = 0;  // 无敌结束时间
        this.speedLaneActive = false;  // 加速通道激活状态
        this.consecutiveAvoids = 0;    // 连续躲避障碍物计数

        // 蛇的运动状态
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        
        // 目标方向和当前方向
        this.targetDirection = 0; // 弧度
        this.currentDirection = 0; // 弧度
        this.moveSpeed = this.DIFFICULTY_CONFIG.baseSpeed; // 使用配置中的基础速度
        
        // 食物位置
        this.food = { x: 20, y: 20 };
        
        // 鼠标位置
        this.mouse = new THREE.Vector2();
        this.targetPosition = new THREE.Vector3();
        
        // Three.js 相关
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.thirdPersonCamera = null;
        this.cameraTarget = null;
        this.snakeMeshes = [];
        this.foodMesh = null;
        this.boardMesh = null;
        this.warningWalls = {
            top: null,
            bottom: null,
            left: null,
            right: null
        };
        
        // 性能优化相关 - Mesh池系统
        this.snakeGeometry = null;
        this.headGeometry = null;
        this.snakeMaterial = null;
        this.headMaterial = null;
        this.foodGeometry = null;
        this.foodMaterial = null;
        this.meshPool = {
            headMeshes: [],      // 蛇头mesh池
            bodyMeshes: [],      // 蛇身mesh池
            usedHeadMeshes: 0,   // 已使用的蛇头mesh数量
            usedBodyMeshes: 0    // 已使用的蛇身mesh数量
        };
        this.lastSnakeLength = 0;
        this.lastUpdateTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // 性能监视器
        this.stats = null;
        
        // UI 元素
        this.scoreElement = document.getElementById('score-value');
        this.statusElement = document.getElementById('game-status');
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    /**
     * 难度控制曲线函数 - 根据蛇的长度计算移动速度
     * 使用组合曲线：线性 + 指数 + 对数增长，确保平滑且有挑战性的难度提升
     * @param {number} length - 当前蛇的长度
     * @returns {number} 计算出的移动速度
     */
    calculateSpeedFromLength(length) {
        const config = this.DIFFICULTY_CONFIG;
        const lengthDiff = Math.max(0, length - config.initialLength);
        
        if (lengthDiff === 0) {
            return config.baseSpeed;
        }
        
        // 分阶段增长曲线
        let speedIncrease = 0;
        
        // 第一阶段：线性增长 (长度3-8)
        if (lengthDiff <= 10) {
            speedIncrease = lengthDiff * config.linearGrowth;
        } 
        // 第二阶段：指数增长 (长度8-15)
        else if (lengthDiff <= 30) {
            const baseIncrease = 5 * config.linearGrowth;
            const exponentialPart = (lengthDiff - 5) * config.linearGrowth * Math.pow(config.exponentialGrowth, (lengthDiff - 5) * 0.1);
            speedIncrease = baseIncrease + exponentialPart;
        }
        // 第三阶段：对数增长 (长度15+) - 防止速度过快
        else {
            const baseIncrease = 5 * config.linearGrowth;
            const exponentialPart = 7 * config.linearGrowth * Math.pow(config.exponentialGrowth, 0.7);
            const logPart = Math.log(lengthDiff - 7) * config.logGrowth;
            speedIncrease = baseIncrease + exponentialPart + logPart;
        }
        
        // 动态平衡机制
        this.updateSurvivalTime();
        
        // 如果蛇长度较短，减缓速度增长
        if (length < config.minSafeLength) {
            speedIncrease *= config.dynamicFactor;
        } else {
            // 长度足够时，根据存活时间逐步恢复难度
            const survivalBonus = Math.min(1, this.survivalTime / config.maxRecoveryTime);
            speedIncrease *= (1 + survivalBonus * config.recoveryRate);
        }
        
        // 连击奖励机制
        if (this.comboCount > 3) {
            speedIncrease *= Math.pow(config.comboMultiplier, Math.min(this.comboCount - 3, 5));
        }
        
        // 计算最终速度并限制在最大值内
        const finalSpeed = config.baseSpeed + speedIncrease;
        return Math.min(finalSpeed, config.maxSpeed);
    }
    
    /**
     * 获取当前难度等级描述
     * @param {number} length - 当前蛇的长度
     * @returns {string} 难度等级描述
     */
    getDifficultyLevel(length) {
        if (length <= 12) return "简单";
        if (length <= 25) return "普通";
        if (length <= 40) return "困难";
        if (length <= 60) return "极难";
        return "地狱";
    }
    
    /**
     * 更新存活时间
     */
    updateSurvivalTime() {
        if (this.gameState === 'playing' && this.gameStartTime > 0) {
            this.survivalTime = Date.now() - this.gameStartTime;
        }
    }
    
    /**
     * 更新移动速度和相关UI显示
     */
    updateDifficulty() {
        const oldSpeed = this.moveSpeed;
        const newSpeed = this.calculateSpeedFromLength(this.snake.length);
        
        this.moveSpeed = newSpeed;
        
        // 更新UI显示当前难度
        const difficultyLevel = this.getDifficultyLevel(this.snake.length);
        const speedDisplay = newSpeed.toFixed(1);
        
        // 在控制台显示难度变化信息
        if (Math.abs(newSpeed - oldSpeed) > 0.1) {
            console.log(`难度提升！长度: ${this.snake.length}, 速度: ${speedDisplay}, 等级: ${difficultyLevel}`);
        }
        
        // 更新状态显示
        if (this.gameState === 'playing') {
            let statusText = `游戏进行中 - 长度: ${this.snake.length} | 速度: ${speedDisplay} | 难度: ${difficultyLevel}`;
            
            // 添加特殊状态指示
            const statusIndicators = [];
            if (this.isInvulnerable) {
                statusIndicators.push('🛡️无敌');
            }
            if (this.snakeStunned.isStunned) {
                statusIndicators.push('😵眩晕');
            }
            if (this.comboCount > 1) {
                statusIndicators.push(`🔥连击x${this.comboCount}`);
            }
            
            if (statusIndicators.length > 0) {
                statusText += ` | ${statusIndicators.join(' ')}`;
            }
            
            this.statusElement.textContent = statusText;
        }
    }
    
    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // 天蓝色背景，适合儿童
        
        // 创建相机 - 第三人称视角
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // 初始相机位置
        this.camera.position.set(0, 80, 40);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        document.getElementById('game-canvas').appendChild(this.renderer.domElement);
        
        // 创建相机目标对象（用于跟随蛇头）
        this.cameraTarget = new THREE.Object3D();
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.cameraTarget.position.copy(headWorldPos);
        this.scene.add(this.cameraTarget);
        
        // 初始化第三人称相机
        this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget);
        
        // 初始化性能监视器
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.left = '10px';
        this.stats.dom.style.top = '100px';
        this.stats.dom.style.zIndex = '1000';
        document.body.appendChild(this.stats.dom);
        
        // 添加mesh池状态显示
        this.meshPoolInfo = document.createElement('div');
        this.meshPoolInfo.style.position = 'absolute';
        this.meshPoolInfo.style.left = '10px';
        this.meshPoolInfo.style.top = '150px';
        this.meshPoolInfo.style.color = 'white';
        this.meshPoolInfo.style.fontSize = '12px';
        this.meshPoolInfo.style.fontFamily = 'monospace';
        this.meshPoolInfo.style.backgroundColor = 'rgba(0,0,0,0.7)';
        this.meshPoolInfo.style.padding = '5px';
        this.meshPoolInfo.style.borderRadius = '3px';
        this.meshPoolInfo.style.zIndex = '1000';
        document.body.appendChild(this.meshPoolInfo);
        
        // 添加调试面板
        this.debugPanel = document.createElement('div');
        this.debugPanel.style.position = 'absolute';
        this.debugPanel.style.right = '10px';
        this.debugPanel.style.top = '100px';
        this.debugPanel.style.color = 'white';
        this.debugPanel.style.fontSize = '12px';
        this.debugPanel.style.fontFamily = 'monospace';
        this.debugPanel.style.backgroundColor = 'rgba(0,0,0,0.8)';
        this.debugPanel.style.padding = '10px';
        this.debugPanel.style.borderRadius = '5px';
        this.debugPanel.style.zIndex = '1000';
        this.debugPanel.style.minWidth = '200px';
        document.body.appendChild(this.debugPanel);
        
        // 调试模式开关
        this.debugMode = false;
        
        // 创建关卡UI
        this.createLevelUI();
        
        // 视觉效果系统
        this.floatingTexts = [];           // 浮动文字数组
        this.screenFlash = null;           // 屏幕闪烁效果
        this.particleEffects = [];         // 粒子效果数组
        
        // 关卡系统
        this.levelSystem = {
            currentLevel: 1,               // 当前关卡
            levelType: 'free',             // 关卡类型：'free', 'score', 'length', 'obstacle'
            isActive: false,               // 关卡是否激活
            startTime: 0,                  // 关卡开始时间
            timeLimit: 0,                  // 时间限制（毫秒）
            targetScore: 0,                // 目标分数
            targetLength: 0,               // 目标长度
            maxObstacles: 0,               // 最大障碍物数量
            decayRate: 0,                  // 衰减速率
            lastDecayTime: 0,              // 上次衰减时间
            completed: false,              // 是否完成
            failed: false                  // 是否失败
        };
        
        // 预定义关卡
        this.levelDefinitions = [
            // 自由模式关卡
            { type: 'free', name: '自由探索', description: '熟悉游戏操作' },
            
            // 分数挑战关卡
            { type: 'score', name: '速度得分', timeLimit: 60000, targetScore: 200, description: '60秒内获得200分' },
            { type: 'score', name: '高分冲刺', timeLimit: 90000, targetScore: 500, description: '90秒内获得500分' },
            
            // 长度挑战关卡
            { type: 'length', name: '成长之路', timeLimit: 120000, targetLength: 15, description: '2分钟内达到15段长度' },
            { type: 'length', name: '巨蛇传说', timeLimit: 180000, targetLength: 25, description: '3分钟内达到25段长度' },
            
            // 障碍物控制关卡
            { type: 'obstacle', name: '清理专家', maxObstacles: 3, decayRate: 0.5, description: '保持场上障碍物不超过3个' },
            { type: 'obstacle', name: '极限控制', maxObstacles: 2, decayRate: 1.0, description: '保持场上障碍物不超过2个' },
            
            // 混合挑战关卡
            { type: 'score', name: '终极挑战', timeLimit: 300000, targetScore: 1000, description: '5分钟内获得1000分' }
        ];
        
        // 添加灯光
        this.setupLighting();
        
        // 创建屏幕闪烁效果
        this.createScreenFlash();
        
        // 创建游戏板
        this.createBoard();
        
        // 创建警告墙体
        this.createWarningWalls();
        
        // 初始化蛇的几何体和材质
        this.initSnakeGeometry();
        
        // 创建蛇
        this.createSnake();
        
        // 创建食物
        this.createFood();
        
        // 初始化难度
        this.updateDifficulty();
        
        // 初始化关卡系统
        this.initializeLevelSystem();
    }
    
    getSnakeHeadWorldPosition() {
        const head = this.snake[0];
        return new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
    }
    
    setupLighting() {
        // 环境光 - 更明亮温暖
        const ambientLight = new THREE.AmbientLight(0xFFFFE0, 0.7); // 淡黄色环境光，更明亮温暖
        this.scene.add(ambientLight);
        
        // 方向光 - 从上方照射
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // 点光源跟随蛇头 - 温暖的光线
        this.snakeLight = new THREE.PointLight(0xFFD700, 0.8, 100); // 金黄色光线，温暖舒适
        this.snakeLight.position.set(0, 10, 0);
        this.scene.add(this.snakeLight);
    }
    
    createBoard() {
        // 游戏板几何体
        const boardGeometry = new THREE.PlaneGeometry(
            this.BOARD_SIZE * this.GRID_SIZE, 
            this.BOARD_SIZE * this.GRID_SIZE
        );
        const boardMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x90EE90, // 浅绿色，像草地一样适合儿童
            transparent: true,
            opacity: 0.8
        });
        
        this.boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
        this.boardMesh.rotation.x = -Math.PI / 2;
        this.boardMesh.receiveShadow = true;
        this.scene.add(this.boardMesh);
        
        // 创建网格线
        this.createGridLines();
    }
    
    createGridLines() {
        const material = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4 }); // 白色网格线，更明亮适合儿童
        
        // 垂直线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
        
        // 水平线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
    }
    
    // 创建警告墙体
    createWarningWalls() {
        const wallHeight = this.GRID_SIZE * 2;
        const wallThickness = 2;
        const boardHalfSize = (this.BOARD_SIZE * this.GRID_SIZE) / 2;
        
        // 创建橙色警告材质 - 比红色更温和，适合儿童
        const warningMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFA500, // 橙色，比红色更温和
            transparent: true,
            opacity: 0.7,
            emissive: 0x442200 // 温暖的橙色发光
        });
        
        // 顶部墙体
        const topGeometry = new THREE.BoxGeometry(this.BOARD_SIZE * this.GRID_SIZE, wallHeight, wallThickness);
        this.warningWalls.top = new THREE.Mesh(topGeometry, warningMaterial);
        this.warningWalls.top.position.set(0, wallHeight / 2, -boardHalfSize - wallThickness / 2);
        this.warningWalls.top.visible = false;
        this.scene.add(this.warningWalls.top);
        
        // 底部墙体
        const bottomGeometry = new THREE.BoxGeometry(this.BOARD_SIZE * this.GRID_SIZE, wallHeight, wallThickness);
        this.warningWalls.bottom = new THREE.Mesh(bottomGeometry, warningMaterial);
        this.warningWalls.bottom.position.set(0, wallHeight / 2, boardHalfSize + wallThickness / 2);
        this.warningWalls.bottom.visible = false;
        this.scene.add(this.warningWalls.bottom);
        
        // 左侧墙体
        const leftGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, this.BOARD_SIZE * this.GRID_SIZE);
        this.warningWalls.left = new THREE.Mesh(leftGeometry, warningMaterial);
        this.warningWalls.left.position.set(-boardHalfSize - wallThickness / 2, wallHeight / 2, 0);
        this.warningWalls.left.visible = false;
        this.scene.add(this.warningWalls.left);
        
        // 右侧墙体
        const rightGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, this.BOARD_SIZE * this.GRID_SIZE);
        this.warningWalls.right = new THREE.Mesh(rightGeometry, warningMaterial);
        this.warningWalls.right.position.set(boardHalfSize + wallThickness / 2, wallHeight / 2, 0);
        this.warningWalls.right.visible = false;
        this.scene.add(this.warningWalls.right);
    }
    
    // 更新边界警告
    updateBoundaryWarning(head) {
        const warningDistance = this.GRID_SIZE * 3; // 警告距离
        const maxBoundary = this.BOARD_SIZE * this.GRID_SIZE;
        
        // 检查蛇头距离各边界的距离
        const distanceToTop = head.actualY;              // 距离顶部边界(y=0)
        const distanceToBottom = maxBoundary - head.actualY; // 距离底部边界
        const distanceToLeft = head.actualX;             // 距离左边界(x=0)
        const distanceToRight = maxBoundary - head.actualX;  // 距离右边界
        
        // 显示/隐藏警告墙体
        this.warningWalls.top.visible = distanceToTop < warningDistance;
        this.warningWalls.bottom.visible = distanceToBottom < warningDistance;
        this.warningWalls.left.visible = distanceToLeft < warningDistance;
        this.warningWalls.right.visible = distanceToRight < warningDistance;
        
        // 调试输出警告状态
        const hasWarning = this.warningWalls.top.visible || this.warningWalls.bottom.visible || 
                          this.warningWalls.left.visible || this.warningWalls.right.visible;
        if (hasWarning) {
            const warnings = [];
            if (this.warningWalls.top.visible) warnings.push('上');
            if (this.warningWalls.bottom.visible) warnings.push('下');
            if (this.warningWalls.left.visible) warnings.push('左');
            if (this.warningWalls.right.visible) warnings.push('右');
            console.log('⚠️ 边界警告:', warnings.join(', '));
        }
        
        // 添加闪烁效果
        const time = Date.now() * 0.005;
        const opacity = 0.4 + Math.sin(time * 1) * 0.3;
        
        if (this.warningWalls.top.visible) {
            this.warningWalls.top.material.opacity = opacity;
        }
        if (this.warningWalls.bottom.visible) {
            this.warningWalls.bottom.material.opacity = opacity;
        }
        if (this.warningWalls.left.visible) {
            this.warningWalls.left.material.opacity = opacity;
        }
        if (this.warningWalls.right.visible) {
            this.warningWalls.right.material.opacity = opacity;
        }
    }
    
    initSnakeGeometry() {
        // 创建共享的几何体
        this.headGeometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.4, 16, 16);
        this.snakeGeometry = new THREE.BoxGeometry(this.GRID_SIZE * 0.35, this.GRID_SIZE * 0.35, this.GRID_SIZE * 0.35);
        
        // 创建共享的材质
        this.headMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFF6347, // 番茄红色，鲜艳可爱
            shininess: 100,
            emissive: 0x441100 // 温暖的发光效果
        });
        
        this.snakeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFF69B4, // 热粉色，活泼可爱
            shininess: 80
        });
        
        // 创建共享的食物几何体和材质
        this.foodGeometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.3, 16, 16);
        this.foodMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFD700, // 金黄色，像阳光一样温暖
            shininess: 100,
            emissive: 0x664400 // 温暖的金色发光
        });
        
        // 创建共享的障碍物几何体和材质
        this.obstacleGeometry = new THREE.BoxGeometry(this.GRID_SIZE * 0.6, this.GRID_SIZE * 0.6, this.GRID_SIZE * 0.6);
        this.obstacleMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFE135, // 明亮黄色，阳光感
            shininess: 80,
            emissive: 0x664400 // 温暖的黄色发光
        });
    }
    
    // 生成障碍物等级和类型
    generateObstacleLevel() {
        const snakeLength = this.snake.length;
        
        // 根据蛇长度智能选择障碍物类型
        const typeChance = Math.random();
        let obstacleType, level;
        
        if (snakeLength <= 5) {
            // 早期：主要是弱障碍物
            if (typeChance < 0.6) {
                obstacleType = 'WEAK';
                level = Math.max(1, snakeLength - 2);
            } else if (typeChance < 0.9) {
                obstacleType = 'NORMAL';
                level = snakeLength;
            } else {
                obstacleType = 'STRONG';
                level = snakeLength + 2;
            }
        } else if (snakeLength <= 15) {
            // 中期：平衡分布
            if (typeChance < 0.3) {
                obstacleType = 'WEAK';
                level = Math.max(1, snakeLength - 3);
            } else if (typeChance < 0.7) {
                obstacleType = 'NORMAL';
                level = snakeLength + Math.floor(Math.random() * 3) - 1;
            } else if (typeChance < 0.95) {
                obstacleType = 'STRONG';
                level = snakeLength + Math.floor(Math.random() * 5) + 1;
            } else {
                obstacleType = 'SPECIAL';
                level = snakeLength + Math.floor(Math.random() * 3);
            }
        } else {
            // 后期：更多危险障碍物
            if (typeChance < 0.2) {
                obstacleType = 'WEAK';
                level = Math.max(1, snakeLength - 5);
            } else if (typeChance < 0.5) {
                obstacleType = 'NORMAL';
                level = snakeLength + Math.floor(Math.random() * 3);
            } else if (typeChance < 0.9) {
                obstacleType = 'STRONG';
                level = snakeLength + Math.floor(Math.random() * 8) + 2;
            } else {
                obstacleType = 'SPECIAL';
                level = snakeLength + Math.floor(Math.random() * 5);
            }
        }
        
        return { type: obstacleType, level: level };
    }
    
    createSnake() {
        const currentLength = this.snake.length;
        
        // 重置mesh使用计数
        this.meshPool.usedHeadMeshes = 0;
        this.meshPool.usedBodyMeshes = 0;
        
        // 隐藏所有mesh
        this.meshPool.headMeshes.forEach(mesh => mesh.visible = false);
        this.meshPool.bodyMeshes.forEach(mesh => mesh.visible = false);

        // 为每个蛇段分配mesh
        this.snake.forEach((segment, index) => {
            let mesh;
            
            if (index === 0) {
                // 蛇头
                mesh = this.getHeadMesh();
                // 蛇头保持原始大小
                mesh.scale.set(1, 1, 1);
            } else {
                // 蛇身
                mesh = this.getBodyMesh();
                mesh.rotation.x = Math.PI / 8;
                mesh.rotation.z = index * 0.1;
                // 蛇身从大到小逐渐缩放
                const scale = this.SNAKE_SCALE_START + (this.SNAKE_SCALE_END - this.SNAKE_SCALE_START) * index / (currentLength - 1);
                mesh.scale.set(scale, scale, scale);
            }
            
            // 显示mesh
            mesh.visible = true;
            
            // 更新snakeMeshes数组
            this.snakeMeshes[index] = mesh;
        });
        
        // 移除多余的引用
        this.snakeMeshes.length = currentLength;
        
        // 更新所有mesh的位置
        this.updateSnakePositions();
        
        // 更新mesh池信息显示
        this.updateMeshPoolInfo();
        
        // 更新调试面板
        this.updateDebugPanel();
    }
    
    // 获取蛇头mesh（从池中或创建新的）
    getHeadMesh() {
        if (this.meshPool.usedHeadMeshes < this.meshPool.headMeshes.length) {
            return this.meshPool.headMeshes[this.meshPool.usedHeadMeshes++];
        }
        
        // 创建新的蛇头mesh
        const mesh = new THREE.Mesh(this.headGeometry, this.headMaterial);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.meshPool.headMeshes.push(mesh);
        this.meshPool.usedHeadMeshes++;
        
        return mesh;
    }
    
    // 获取蛇身mesh（从池中或创建新的）
    getBodyMesh() {
        if (this.meshPool.usedBodyMeshes < this.meshPool.bodyMeshes.length) {
            return this.meshPool.bodyMeshes[this.meshPool.usedBodyMeshes++];
        }
        
        // 创建新的蛇身mesh
        const mesh = new THREE.Mesh(this.snakeGeometry, this.snakeMaterial);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.meshPool.bodyMeshes.push(mesh);
        this.meshPool.usedBodyMeshes++;
        
        return mesh;
    }
    
    // 更新mesh池信息显示
    updateMeshPoolInfo() {
        const headPoolSize = this.meshPool.headMeshes.length;
        const bodyPoolSize = this.meshPool.bodyMeshes.length;
        const usedHead = this.meshPool.usedHeadMeshes;
        const usedBody = this.meshPool.usedBodyMeshes;
        
        // 统计下落中的障碍物数量
        const fallingObstacles = this.obstacles.filter(obs => obs.isFalling).length;
        const landedObstacles = this.obstacles.filter(obs => obs.hasLanded).length;
        
        this.meshPoolInfo.innerHTML = `
            <div>Mesh池状态:</div>
            <div>蛇头: ${usedHead}/${headPoolSize}</div>
            <div>蛇身: ${usedBody}/${bodyPoolSize}</div>
            <div>总复用: ${headPoolSize + bodyPoolSize}</div>
            <div>蛇长度: ${this.snake.length}</div>
            <div>障碍物: ${this.obstacles.length}</div>
            <div>下落中: ${fallingObstacles}</div>
            <div>已落地: ${landedObstacles}</div>
            <div>眩晕: ${this.snakeStunned.isStunned ? '是' : '否'}</div>
            <div>无敌: ${this.isInvulnerable ? '是' : '否'}</div>
            <div>连击: ${this.comboCount}</div>
            <div>存活: ${(this.survivalTime / 1000).toFixed(1)}s</div>
        `;
    }
    
    // 更新调试面板
    updateDebugPanel() {
        if (!this.debugMode) {
            this.debugPanel.style.display = 'none';
            return;
        }
        
        this.debugPanel.style.display = 'block';
        
        // 计算各种统计数据
        const difficultyLevel = this.getDifficultyLevel(this.snake.length);
        const speedPercent = ((this.moveSpeed / this.DIFFICULTY_CONFIG.maxSpeed) * 100).toFixed(1);
        const survivalMinutes = (this.survivalTime / 60000).toFixed(1);
        
        // 障碍物类型统计
        const obstacleStats = {};
        this.obstacles.forEach(obs => {
            obstacleStats[obs.type] = (obstacleStats[obs.type] || 0) + 1;
        });
        
        this.debugPanel.innerHTML = `
            <div><strong>🎮 游戏调试面板</strong></div>
            <div>━━━━━━━━━━━━━━━━</div>
            <div>🐍 蛇长度: ${this.snake.length}</div>
            <div>⚡ 速度: ${this.moveSpeed.toFixed(1)} (${speedPercent}%)</div>
            <div>🎯 难度: ${difficultyLevel}</div>
            <div>🏆 得分: ${this.score}</div>
            <div>🔥 连击: ${this.comboCount}</div>
            <div>⏱️ 存活: ${survivalMinutes}分钟</div>
            <div>━━━━━━━━━━━━━━━━</div>
            <div>🟢 弱障碍: ${obstacleStats.WEAK || 0}</div>
            <div>🟡 普通障碍: ${obstacleStats.NORMAL || 0}</div>
            <div>🔴 强障碍: ${obstacleStats.STRONG || 0}</div>
            <div>🔵 特殊障碍: ${obstacleStats.SPECIAL || 0}</div>
            <div>━━━━━━━━━━━━━━━━</div>
            <div>🛡️ 无敌: ${this.isInvulnerable ? '激活' : '关闭'}</div>
            <div>😵 眩晕: ${this.snakeStunned.isStunned ? '激活' : '关闭'}</div>
            <div>📳 抖动: ${this.cameraShake.isShaking ? '激活' : '关闭'}</div>
            <div>━━━━━━━━━━━━━━━━</div>
            <div style="font-size: 10px; color: #888;">按 D 键切换调试模式</div>
        `;
    }
    
    // 创建屏幕闪烁效果
    createScreenFlash() {
        const flashGeometry = new THREE.PlaneGeometry(2, 2);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false
        });
        
        this.screenFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        this.screenFlash.position.z = -0.1;
        this.camera.add(this.screenFlash);
        this.scene.add(this.camera);
    }
    
    // 屏幕闪烁效果
    flashScreenColor(color, intensity, duration) {
        if (!this.screenFlash) return;
        
        this.screenFlash.material.color.setHex(color);
        this.screenFlash.material.opacity = intensity;
        
        // 渐变消失
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                this.screenFlash.material.opacity = 0;
                return;
            }
            
            this.screenFlash.material.opacity = intensity * (1 - progress);
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // 显示浮动文字
    showFloatingText(text, obstacle, color) {
        // 创建文字纹理
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // 绘制文字
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 32);
        
        // 创建纹理和材质
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const geometry = new THREE.PlaneGeometry(8, 2);
        const textMesh = new THREE.Mesh(geometry, material);
        
        // 设置位置
        textMesh.position.set(
            obstacle.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE * 2,
            obstacle.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        // 面向相机
        textMesh.lookAt(this.camera.position);
        
        this.scene.add(textMesh);
        
        // 添加到浮动文字数组
        const floatingText = {
            mesh: textMesh,
            startTime: Date.now(),
            duration: 2000,
            startY: textMesh.position.y,
            targetY: textMesh.position.y + 15
        };
        
        this.floatingTexts.push(floatingText);
    }
    
    // 显示奖励特效
    showRewardEffect(obstacle) {
        // 创建金色粒子爆炸效果
        this.createParticleExplosion(
            obstacle.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE * 2,
            obstacle.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0xffd700, // 金色
            20 // 粒子数量
        );
    }
    
    // 显示惩罚特效
    showPenaltyEffect(obstacle) {
        // 创建红色粒子爆炸效果
        this.createParticleExplosion(
            obstacle.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE * 2,
            obstacle.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0xff0000, // 红色
            15 // 粒子数量
        );
    }
    
    // 创建粒子爆炸效果
    createParticleExplosion(x, y, z, color, particleCount) {
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.set(x, y, z);
            
            // 随机速度
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                Math.random() * 15 + 5,
                (Math.random() - 0.5) * 20
            );
            
            particles.push({
                mesh: particle,
                velocity: velocity,
                life: 1.0,
                decay: 0.02
            });
            
            this.scene.add(particle);
        }
        
        this.particleEffects.push({
            particles: particles,
            startTime: Date.now()
        });
    }
    
    // 更新视觉效果
    updateVisualEffects() {
        // 更新浮动文字
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const floatingText = this.floatingTexts[i];
            const elapsed = Date.now() - floatingText.startTime;
            const progress = elapsed / floatingText.duration;
            
            if (progress >= 1) {
                // 移除过期的文字
                this.scene.remove(floatingText.mesh);
                floatingText.mesh.geometry.dispose();
                floatingText.mesh.material.dispose();
                this.floatingTexts.splice(i, 1);
            } else {
                // 更新位置和透明度
                floatingText.mesh.position.y = floatingText.startY + (floatingText.targetY - floatingText.startY) * progress;
                floatingText.mesh.material.opacity = 1 - progress;
                
                // 面向相机
                floatingText.mesh.lookAt(this.camera.position);
            }
        }
        
        // 更新粒子效果
        for (let i = this.particleEffects.length - 1; i >= 0; i--) {
            const effect = this.particleEffects[i];
            let allParticlesDead = true;
            
            for (let j = effect.particles.length - 1; j >= 0; j--) {
                const particle = effect.particles[j];
                
                if (particle.life <= 0) {
                    // 移除死亡粒子
                    this.scene.remove(particle.mesh);
                    particle.mesh.geometry.dispose();
                    particle.mesh.material.dispose();
                    effect.particles.splice(j, 1);
                } else {
                    // 更新粒子
                    particle.mesh.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    particle.velocity.y -= 0.5; // 重力
                    particle.life -= particle.decay;
                    particle.mesh.material.opacity = particle.life;
                    
                    allParticlesDead = false;
                }
            }
            
            if (allParticlesDead) {
                this.particleEffects.splice(i, 1);
            }
        }
    }
    
    // 创建关卡UI
    createLevelUI() {
        // 关卡信息面板
        this.levelPanel = document.createElement('div');
        this.levelPanel.style.position = 'absolute';
        this.levelPanel.style.top = '10px';
        this.levelPanel.style.left = '50%';
        this.levelPanel.style.transform = 'translateX(-50%)';
        this.levelPanel.style.color = 'white';
        this.levelPanel.style.fontSize = '16px';
        this.levelPanel.style.fontFamily = 'Arial, sans-serif';
        this.levelPanel.style.backgroundColor = 'rgba(0,0,0,0.8)';
        this.levelPanel.style.padding = '15px';
        this.levelPanel.style.borderRadius = '10px';
        this.levelPanel.style.zIndex = '1000';
        this.levelPanel.style.textAlign = 'center';
        this.levelPanel.style.minWidth = '300px';
        document.body.appendChild(this.levelPanel);
        
        // 关卡选择面板
        this.levelSelectPanel = document.createElement('div');
        this.levelSelectPanel.style.position = 'absolute';
        this.levelSelectPanel.style.top = '50%';
        this.levelSelectPanel.style.left = '50%';
        this.levelSelectPanel.style.transform = 'translate(-50%, -50%)';
        this.levelSelectPanel.style.color = 'white';
        this.levelSelectPanel.style.fontSize = '14px';
        this.levelSelectPanel.style.fontFamily = 'Arial, sans-serif';
        this.levelSelectPanel.style.backgroundColor = 'rgba(0,0,0,0.9)';
        this.levelSelectPanel.style.padding = '20px';
        this.levelSelectPanel.style.borderRadius = '15px';
        this.levelSelectPanel.style.zIndex = '1001';
        this.levelSelectPanel.style.maxWidth = '500px';
        this.levelSelectPanel.style.maxHeight = '400px';
        this.levelSelectPanel.style.overflowY = 'auto';
        this.levelSelectPanel.style.display = 'none';
        document.body.appendChild(this.levelSelectPanel);
        
        // 进度条
        this.progressBar = document.createElement('div');
        this.progressBar.style.position = 'absolute';
        this.progressBar.style.top = '80px';
        this.progressBar.style.left = '50%';
        this.progressBar.style.transform = 'translateX(-50%)';
        this.progressBar.style.width = '300px';
        this.progressBar.style.height = '10px';
        this.progressBar.style.backgroundColor = 'rgba(255,255,255,0.3)';
        this.progressBar.style.borderRadius = '5px';
        this.progressBar.style.zIndex = '1000';
        this.progressBar.style.display = 'none';
        document.body.appendChild(this.progressBar);
        
        this.progressFill = document.createElement('div');
        this.progressFill.style.height = '100%';
        this.progressFill.style.backgroundColor = '#00ff88';
        this.progressFill.style.borderRadius = '5px';
        this.progressFill.style.width = '0%';
        this.progressFill.style.transition = 'width 0.3s ease';
        this.progressBar.appendChild(this.progressFill);
    }
    
    // 初始化关卡系统
    initializeLevelSystem() {
        this.loadLevel(1);
        this.updateLevelUI();
    }
    
    // 加载关卡
    loadLevel(levelNumber) {
        if (levelNumber < 1 || levelNumber > this.levelDefinitions.length) {
            console.log('关卡不存在:', levelNumber);
            return;
        }
        
        // 清理所有对话框
        this.clearAllDialogs();
        
        const levelDef = this.levelDefinitions[levelNumber - 1];
        this.levelSystem.currentLevel = levelNumber;
        this.levelSystem.levelType = levelDef.type;
        this.levelSystem.isActive = false;
        this.levelSystem.completed = false;
        this.levelSystem.failed = false;
        this.levelSystem.startTime = 0;
        this.levelSystem.lastDecayTime = 0;
        
        // 设置关卡参数
        this.levelSystem.timeLimit = levelDef.timeLimit || 0;
        this.levelSystem.targetScore = levelDef.targetScore || 0;
        this.levelSystem.targetLength = levelDef.targetLength || 0;
        this.levelSystem.maxObstacles = levelDef.maxObstacles || 0;
        this.levelSystem.decayRate = levelDef.decayRate || 0;
        
        console.log('加载关卡:', levelNumber, levelDef.name);
        this.updateLevelUI();
    }
    
    // 开始关卡
    startLevel() {
        // 清理所有对话框
        this.clearAllDialogs();
        
        if (this.levelSystem.levelType === 'free') {
            // 自由模式直接开始游戏
            this.levelSystem.isActive = true;
            this.startGame();
        } else {
            // 挑战模式需要重置游戏状态
            this.resetGame();
            // 重置后重新激活关卡系统
            this.levelSystem.isActive = true;
            this.levelSystem.completed = false;
            this.levelSystem.failed = false;
            this.levelSystem.startTime = Date.now();
            this.levelSystem.lastDecayTime = Date.now();
            this.startGame();
        }
    }
    
    // 加载并开始关卡（用于"下一关"按钮）
    loadAndStartLevel(levelNumber) {
        console.log('🎮 加载并开始关卡:', levelNumber);
        
        // 先加载关卡
        this.loadLevel(levelNumber);
        
        // 然后立即开始关卡
        setTimeout(() => {
            console.log('🚀 开始关卡:', this.levelSystem.levelType, '时间限制:', this.levelSystem.timeLimit);
            this.startLevel();
        }, 100); // 短暂延迟确保UI更新完成
    }
    
    // 更新关卡UI
    updateLevelUI() {
        const levelDef = this.levelDefinitions[this.levelSystem.currentLevel - 1];
        
        if (!levelDef) return;
        
        let levelInfo = `<div><strong>关卡 ${this.levelSystem.currentLevel}: ${levelDef.name}</strong></div>`;
        levelInfo += `<div style="font-size: 12px; margin-top: 5px;">${levelDef.description}</div>`;
        
        if (this.levelSystem.isActive && this.gameState === 'playing') {
            // 显示关卡进度
            if (this.levelSystem.timeLimit > 0) {
                const elapsed = Date.now() - this.levelSystem.startTime;
                const remaining = Math.max(0, this.levelSystem.timeLimit - elapsed);
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                
                // 时间不足时变红色警告
                const timeColor = remaining < 10000 ? 'red' : 'white';
                levelInfo += `<div style="margin-top: 5px; color: ${timeColor};">⏰ 剩余时间: ${minutes}:${seconds.toString().padStart(2, '0')}</div>`;
                
                // 更新进度条
                const progress = Math.min(100, (elapsed / this.levelSystem.timeLimit) * 100);
                this.progressFill.style.width = progress + '%';
                // 时间不足时进度条变红
                this.progressFill.style.backgroundColor = remaining < 10000 ? '#ff4444' : '#00ff88';
                this.progressBar.style.display = 'block';
            }
            
            if (this.levelSystem.targetScore > 0) {
                const progress = Math.min(100, (this.score / this.levelSystem.targetScore) * 100);
                levelInfo += `<div style="margin-top: 5px;">🎯 分数: ${this.score}/${this.levelSystem.targetScore} (${progress.toFixed(1)}%)</div>`;
            }
            
            if (this.levelSystem.targetLength > 0) {
                const progress = Math.min(100, (this.snake.length / this.levelSystem.targetLength) * 100);
                levelInfo += `<div style="margin-top: 5px;">🐍 长度: ${this.snake.length}/${this.levelSystem.targetLength} (${progress.toFixed(1)}%)</div>`;
            }
            
            if (this.levelSystem.maxObstacles > 0) {
                const currentObstacles = this.obstacles.length;
                const isOverLimit = currentObstacles > this.levelSystem.maxObstacles;
                const color = isOverLimit ? 'red' : 'white';
                levelInfo += `<div style="margin-top: 5px; color: ${color};">⚠️ 障碍物: ${currentObstacles}/${this.levelSystem.maxObstacles}</div>`;
            }
        } else {
            // 显示关卡要求
            if (this.levelSystem.timeLimit > 0) {
                const minutes = Math.floor(this.levelSystem.timeLimit / 60000);
                const seconds = Math.floor((this.levelSystem.timeLimit % 60000) / 1000);
                levelInfo += `<div style="margin-top: 5px;">⏰ 时间限制: ${minutes}:${seconds.toString().padStart(2, '0')}</div>`;
            }
            
            if (this.levelSystem.targetScore > 0) {
                levelInfo += `<div style="margin-top: 5px;">🎯 目标分数: ${this.levelSystem.targetScore}</div>`;
            }
            
            if (this.levelSystem.targetLength > 0) {
                levelInfo += `<div style="margin-top: 5px;">🐍 目标长度: ${this.levelSystem.targetLength}</div>`;
            }
            
            if (this.levelSystem.maxObstacles > 0) {
                levelInfo += `<div style="margin-top: 5px;">⚠️ 最大障碍物: ${this.levelSystem.maxObstacles}</div>`;
                levelInfo += `<div style="margin-top: 5px;">📉 超限衰减: ${this.levelSystem.decayRate}/秒</div>`;
            }
            
            this.progressBar.style.display = 'none';
        }
        
        // 添加关卡选择按钮
        if (this.gameState === 'waiting') {
            levelInfo += `<div style="margin-top: 10px;">
                <button onclick="game.showLevelSelect()" style="margin: 5px; padding: 5px 10px; background: #444; color: white; border: none; border-radius: 5px; cursor: pointer;">选择关卡</button>
                <button onclick="game.startLevel()" style="margin: 5px; padding: 5px 10px; background: #00aa44; color: white; border: none; border-radius: 5px; cursor: pointer;">开始关卡</button>
            </div>`;
        }
        
        this.levelPanel.innerHTML = levelInfo;
    }
    
    // 显示关卡选择界面
    showLevelSelect() {
        let content = '<div style="text-align: center; margin-bottom: 15px;"><strong>选择关卡</strong></div>';
        
        this.levelDefinitions.forEach((levelDef, index) => {
            const levelNumber = index + 1;
            const isCurrentLevel = levelNumber === this.levelSystem.currentLevel;
            const buttonStyle = isCurrentLevel ? 
                'background: #00aa44; color: white;' : 
                'background: #666; color: white;';
            
            content += `
                <div style="margin: 10px 0; padding: 10px; border: 1px solid #666; border-radius: 5px; ${isCurrentLevel ? 'border-color: #00aa44;' : ''}">
                    <div><strong>关卡 ${levelNumber}: ${levelDef.name}</strong></div>
                    <div style="font-size: 12px; margin: 5px 0;">${levelDef.description}</div>
                    <button onclick="game.selectLevel(${levelNumber})" style="padding: 5px 15px; ${buttonStyle} border: none; border-radius: 3px; cursor: pointer;">
                        ${isCurrentLevel ? '当前关卡' : '选择'}
                    </button>
                </div>
            `;
        });
        
        content += `
            <div style="text-align: center; margin-top: 15px;">
                <button onclick="game.hideLevelSelect()" style="padding: 8px 20px; background: #888; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        `;
        
        this.levelSelectPanel.innerHTML = content;
        this.levelSelectPanel.style.display = 'block';
    }
    
    // 选择关卡
    selectLevel(levelNumber) {
        this.loadLevel(levelNumber);
        this.hideLevelSelect();
    }
    
    // 隐藏关卡选择界面
    hideLevelSelect() {
        this.levelSelectPanel.style.display = 'none';
    }
    
    // 更新关卡系统
    updateLevelSystem() {
        if (!this.levelSystem.isActive || this.gameState !== 'playing') {
            return;
        }
        
        const currentTime = Date.now();
        
        // 调试信息（每5秒输出一次）
        if (currentTime % 5000 < 16) { // 大约每5秒
            console.log('⏰ 关卡系统更新:', {
                type: this.levelSystem.levelType,
                isActive: this.levelSystem.isActive,
                timeLimit: this.levelSystem.timeLimit,
                elapsed: currentTime - this.levelSystem.startTime,
                gameState: this.gameState
            });
        }
        
        // 检查时间限制
        if (this.levelSystem.timeLimit > 0) {
            const elapsed = currentTime - this.levelSystem.startTime;
            if (elapsed >= this.levelSystem.timeLimit) {
                this.checkLevelCompletion();
                if (!this.levelSystem.completed) {
                    this.levelFailed('时间到！');
                    return;
                }
            }
        }
        
        // 检查障碍物控制关卡的衰减机制
        if (this.levelSystem.maxObstacles > 0) {
            const currentObstacles = this.obstacles.length;
            if (currentObstacles > this.levelSystem.maxObstacles) {
                // 超过限制，开始衰减
                const timeSinceLastDecay = currentTime - this.levelSystem.lastDecayTime;
                if (timeSinceLastDecay >= 1000) { // 每秒衰减一次
                    this.applyObstacleDecay();
                    this.levelSystem.lastDecayTime = currentTime;
                }
            } else {
                // 重置衰减时间
                this.levelSystem.lastDecayTime = currentTime;
            }
        }
        
        // 检查关卡完成条件
        this.checkLevelCompletion();
        
        // 更新UI
        this.updateLevelUI();
    }
    
    // 检查关卡完成条件
    checkLevelCompletion() {
        if (this.levelSystem.completed || this.levelSystem.failed) {
            return;
        }
        
        let completed = false;
        
        switch (this.levelSystem.levelType) {
            case 'free':
                // 自由模式没有完成条件
                completed = false;
                break;
                
            case 'score':
                // 分数挑战：达到目标分数
                if (this.score >= this.levelSystem.targetScore) {
                    completed = true;
                }
                break;
                
            case 'length':
                // 长度挑战：达到目标长度
                if (this.snake.length >= this.levelSystem.targetLength) {
                    completed = true;
                }
                break;
                
            case 'obstacle':
                // 障碍物控制：持续一定时间保持在限制内
                const currentObstacles = this.obstacles.length;
                if (currentObstacles <= this.levelSystem.maxObstacles) {
                    // 可以设置一个持续时间要求，这里简化为持续30秒
                    const elapsed = Date.now() - this.levelSystem.startTime;
                    if (elapsed >= 30000) { // 30秒
                        completed = true;
                    }
                }
                break;
        }
        
        if (completed) {
            this.levelCompleted();
        }
    }
    
    // 关卡完成
    levelCompleted() {
        this.levelSystem.completed = true;
        this.levelSystem.isActive = false;
        
        // 显示完成信息
        const levelDef = this.levelDefinitions[this.levelSystem.currentLevel - 1];
        this.showFloatingText('关卡完成!', { x: 15, y: 15 }, 0xFFD700); // 金黄色，庆祝感
        this.flashScreenColor(0xFFD700, 0.4, 500);
        
        // 暂停游戏
        this.pauseGame();
        
        console.log('🎉 关卡完成!', levelDef.name);
        
        // 显示完成UI
        setTimeout(() => {
            this.showLevelCompleteDialog();
        }, 1000);
    }
    
    // 关卡失败
    levelFailed(reason) {
        this.levelSystem.failed = true;
        this.levelSystem.isActive = false;
        
        // 显示失败信息和视觉效果
        this.showFloatingText('关卡失败!', { x: 15, y: 15 }, 0xFF6B6B); // 温暖的红色，不太刺眼
        this.flashScreenColor(0xFF6B6B, 0.5, 600);
        this.startCameraShake(1.5, 800);
        
        // 暂停游戏
        this.pauseGame();
        
        console.log('💥 关卡失败:', reason);
        
        // 显示失败UI
        setTimeout(() => {
            this.showLevelFailedDialog(reason);
        }, 1000);
    }
    
    // 应用障碍物衰减
    applyObstacleDecay() {
        const decayAmount = this.levelSystem.decayRate;
        
        // 减少分数
        this.score = Math.max(0, this.score - Math.floor(decayAmount * 10));
        
        // 减少蛇长度
        if (this.snake.length > 3 && Math.random() < decayAmount * 0.1) {
            this.snake.pop();
            this.createSnake();
            this.updateDifficulty();
        }
        
        // 显示衰减效果
        this.showFloatingText(`-${Math.floor(decayAmount * 10)}分`, { x: 15, y: 13 }, 0xFFA500); // 橙色，温和的警告
        this.flashScreenColor(0xFFA500, 0.2, 200);
        
        this.updateScore();
        console.log('📉 障碍物过多，衰减中...', '分数:', this.score, '长度:', this.snake.length);
    }
    
    // 显示关卡完成对话框
    showLevelCompleteDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'level-dialog';
        dialog.style.position = 'absolute';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'rgba(0, 100, 0, 0.9)';
        dialog.style.color = 'white';
        dialog.style.padding = '30px';
        dialog.style.borderRadius = '15px';
        dialog.style.textAlign = 'center';
        dialog.style.zIndex = '1002';
        dialog.style.fontSize = '18px';
        dialog.style.fontFamily = 'Arial, sans-serif';
        
        const levelDef = this.levelDefinitions[this.levelSystem.currentLevel - 1];
        const nextLevel = this.levelSystem.currentLevel + 1;
        const hasNextLevel = nextLevel <= this.levelDefinitions.length;
        
        dialog.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">🎉 关卡完成！</div>
            <div style="margin-bottom: 10px;"><strong>${levelDef.name}</strong></div>
            <div style="margin-bottom: 15px;">最终分数: ${this.score}</div>
            <div style="margin-bottom: 15px;">最终长度: ${this.snake.length}</div>
            <div style="margin-bottom: 20px;">
                                 ${hasNextLevel ? 
                     `<button onclick="game.loadAndStartLevel(${nextLevel})" style="margin: 5px; padding: 10px 20px; background: #00aa44; color: white; border: none; border-radius: 5px; cursor: pointer;">下一关</button>` : 
                     '<div style="color: #ffff00;">🏆 恭喜通关所有关卡！</div>'
                 }
                <button onclick="game.removeDialog(this.parentElement)" style="margin: 5px; padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    // 显示关卡失败对话框
    showLevelFailedDialog(reason) {
        const dialog = document.createElement('div');
        dialog.className = 'level-dialog';
        dialog.style.position = 'absolute';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'rgba(100, 0, 0, 0.9)';
        dialog.style.color = 'white';
        dialog.style.padding = '30px';
        dialog.style.borderRadius = '15px';
        dialog.style.textAlign = 'center';
        dialog.style.zIndex = '1002';
        dialog.style.fontSize = '18px';
        dialog.style.fontFamily = 'Arial, sans-serif';
        
        dialog.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">💥 关卡失败</div>
            <div style="margin-bottom: 10px;">${reason}</div>
            <div style="margin-bottom: 15px;">最终分数: ${this.score}</div>
            <div style="margin-bottom: 15px;">最终长度: ${this.snake.length}</div>
            <div style="margin-bottom: 20px;">
                                 <button onclick="game.startLevel()" style="margin: 5px; padding: 10px 20px; background: #aa4400; color: white; border: none; border-radius: 5px; cursor: pointer;">重试</button>
                <button onclick="game.removeDialog(this.parentElement)" style="margin: 5px; padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    // 显示游戏结束对话框（自由模式）
    showGameOverDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'level-dialog';
        dialog.style.position = 'absolute';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'rgba(80, 80, 80, 0.9)';
        dialog.style.color = 'white';
        dialog.style.padding = '30px';
        dialog.style.borderRadius = '15px';
        dialog.style.textAlign = 'center';
        dialog.style.zIndex = '1002';
        dialog.style.fontSize = '18px';
        dialog.style.fontFamily = 'Arial, sans-serif';
        
        dialog.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">💀 游戏结束</div>
            <div style="margin-bottom: 10px;">撞墙或撞到自己！</div>
            <div style="margin-bottom: 15px;">最终分数: ${this.score}</div>
            <div style="margin-bottom: 15px;">最终长度: ${this.snake.length}</div>
            <div style="margin-bottom: 20px;">
                <button onclick="game.resetGame(); game.removeDialog(this.parentElement)" style="margin: 5px; padding: 10px 20px; background: #aa4400; color: white; border: none; border-radius: 5px; cursor: pointer;">重新开始</button>
                <button onclick="game.removeDialog(this.parentElement)" style="margin: 5px; padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    // 移除对话框
    removeDialog(dialog) {
        if (dialog && dialog.parentElement) {
            dialog.parentElement.removeChild(dialog);
        }
    }
    
    // 清理所有对话框
    clearAllDialogs() {
        // 查找并移除所有关卡对话框
        const dialogs = document.querySelectorAll('.level-dialog');
        dialogs.forEach(dialog => {
            if (dialog.parentElement) {
                dialog.parentElement.removeChild(dialog);
            }
        });
    }
    
    updateSnakePositions() {
        this.snake.forEach((segment, index) => {
            const mesh = this.snakeMeshes[index];
            if (mesh) {
                // 更新位置
                mesh.position.set(
                    segment.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
                    this.GRID_SIZE / 2,
                    segment.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
                );
                
                // 蛇身的旋转动画
                if (index > 0) {
                    mesh.rotation.y = index * 0.1 + Date.now() * 0.001;
                }
            }
        });
    }
    
    createFood() {
        // 如果食物mesh不存在，创建它
        if (!this.foodMesh) {
            this.foodMesh = new THREE.Mesh(this.foodGeometry, this.foodMaterial);
            this.foodMesh.castShadow = true;
            this.scene.add(this.foodMesh);
        }
        
        // 更新食物位置
        this.updateFoodPosition();
    }
    
    updateFoodPosition() {
        if (this.foodMesh) {
            this.foodMesh.position.set(
                this.food.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
                this.GRID_SIZE / 2,
                this.food.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
            );
        }
    }
    
    generateFood() {
        let newFood;
        let attempts = 0;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.BOARD_SIZE),
                y: Math.floor(Math.random() * this.BOARD_SIZE)
            };
            attempts++;
        } while (this.isPositionOccupied(newFood.x, newFood.y) && attempts < 100);
        
        if (attempts >= 100) {
            console.log('无法找到合适的食物位置');
            // 如果找不到位置，随机选择一个不与蛇身重叠的位置
            do {
                newFood = {
                    x: Math.floor(Math.random() * this.BOARD_SIZE),
                    y: Math.floor(Math.random() * this.BOARD_SIZE)
                };
            } while (this.snake.some(segment => 
                Math.floor(segment.actualX / this.GRID_SIZE) === newFood.x && 
                Math.floor(segment.actualY / this.GRID_SIZE) === newFood.y
            ));
        }
        
        this.food = newFood;
        this.updateFoodPosition(); // 使用updateFoodPosition而不是createFood
    }
    
    setupEventListeners() {
        // 鼠标移动事件
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // 计算目标方向
            if (this.gameState === 'playing') {
                this.updateTargetDirection();
            }
        });
        
        // 键盘事件保留部分功能
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event.key);
        });
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }
    
    updateTargetDirection() {
        // 将鼠标坐标转换为世界坐标
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);
        
        // 与地面平面相交
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);
        
        // 计算从蛇头到鼠标位置的方向
        const head = this.snake[0];
        const headWorldPos = new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        const direction = intersection.sub(headWorldPos);
        this.targetDirection = Math.atan2(direction.z, direction.x);
    }
    
    handleKeyPress(key) {
        switch (key.toLowerCase()) {
            case ' ':
                this.toggleGame();
                break;
            case 'r':
                this.resetGame();
                break;
            case 'd':
                this.debugMode = !this.debugMode;
                console.log('调试模式:', this.debugMode ? '开启' : '关闭');
                break;
        }
    }
    
    toggleGame() {
        if (this.gameState === 'waiting' || this.gameState === 'paused') {
            this.startGame();
        } else if (this.gameState === 'playing') {
            this.pauseGame();
        } else if (this.gameState === 'gameOver') {
            this.resetGame();
        }
    }
    
    startGame() {
        if (this.gameState === 'waiting') {
            this.gameState = 'playing';
            this.gameStartTime = Date.now(); // 记录游戏开始时间
            this.updateDifficulty(); // 更新难度显示
            this.scheduleNextObstacle(); // 安排第一个障碍物
            this.gameLoop();
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.updateDifficulty(); // 更新难度显示
            this.gameLoop();
        }
    }
    
    pauseGame() {
        this.gameState = 'paused';
        this.statusElement.textContent = '游戏已暂停';
        this.statusElement.className = 'game-paused';
        
        // 隐藏所有警告墙体
        this.hideAllWarningWalls();
    }
    
    resetGame() {
        // 清理所有对话框
        this.clearAllDialogs();
        
        this.gameState = 'waiting';
        this.score = 0;
        this.currentDirection = 0;
        this.targetDirection = 0;
        
        // 重置新增状态
        this.gameStartTime = 0;
        this.survivalTime = 0;
        this.comboCount = 0;
        this.lastFoodTime = 0;
        this.isInvulnerable = false;
        this.invulnerableEndTime = 0;
        this.speedLaneActive = false;
        this.consecutiveAvoids = 0;
        
        // 重置关卡状态（但保留当前关卡选择和类型）
        const preserveLevel = this.levelSystem.currentLevel;
        const preserveType = this.levelSystem.levelType;
        const preserveTimeLimit = this.levelSystem.timeLimit;
        const preserveTargetScore = this.levelSystem.targetScore;
        const preserveTargetLength = this.levelSystem.targetLength;
        const preserveMaxObstacles = this.levelSystem.maxObstacles;
        const preserveDecayRate = this.levelSystem.decayRate;
        
        this.levelSystem.isActive = false;
        this.levelSystem.completed = false;
        this.levelSystem.failed = false;
        this.levelSystem.startTime = 0;
        this.levelSystem.lastDecayTime = 0;
        
        // 恢复关卡配置
        this.levelSystem.currentLevel = preserveLevel;
        this.levelSystem.levelType = preserveType;
        this.levelSystem.timeLimit = preserveTimeLimit;
        this.levelSystem.targetScore = preserveTargetScore;
        this.levelSystem.targetLength = preserveTargetLength;
        this.levelSystem.maxObstacles = preserveMaxObstacles;
        this.levelSystem.decayRate = preserveDecayRate;
        
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        this.food = { x: 20, y: 20 };
        
        // 重置难度到初始状态
        this.updateDifficulty();
        
        this.updateScore();
        this.statusElement.textContent = '按空格键开始游戏';
        this.statusElement.className = '';
        
        // 使用mesh池系统重置蛇，而不是销毁mesh
        this.snakeMeshes = [];
        this.lastSnakeLength = 0;
        
        this.createSnake();
        this.createFood();
        
        // 重置相机目标位置
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.cameraTarget.position.copy(headWorldPos);
        
        // 重置第三人称相机
        this.thirdPersonCamera.reset();
        
        // 隐藏所有警告墙体
        this.hideAllWarningWalls();
        
        // 清理所有障碍物
        this.clearAllObstacles();
        
        // 重置相机抖动和眩晕状态
        this.cameraShake.isShaking = false;
        this.snakeStunned.isStunned = false;
        
        // 清理视觉效果
        this.clearAllVisualEffects();
        
        // 更新关卡UI
        this.updateLevelUI();
    }
    
    // 清理所有视觉效果
    clearAllVisualEffects() {
        // 清理浮动文字
        this.floatingTexts.forEach(floatingText => {
            this.scene.remove(floatingText.mesh);
            floatingText.mesh.geometry.dispose();
            floatingText.mesh.material.dispose();
        });
        this.floatingTexts = [];
        
        // 清理粒子效果
        this.particleEffects.forEach(effect => {
            effect.particles.forEach(particle => {
                this.scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
            });
        });
        this.particleEffects = [];
        
        // 重置屏幕闪烁
        if (this.screenFlash) {
            this.screenFlash.material.opacity = 0;
        }
    }
    
    // 隐藏所有警告墙体
    hideAllWarningWalls() {
        this.warningWalls.top.visible = false;
        this.warningWalls.bottom.visible = false;
        this.warningWalls.left.visible = false;
        this.warningWalls.right.visible = false;
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        this.update();

        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    update() {
        // 圆滑转弯 - 插值当前方向到目标方向
        let angleDiff = this.targetDirection - this.currentDirection;
        
        // 处理角度环绕
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        this.currentDirection += angleDiff * this.TURN_SPEED;
        
        // 移动蛇头 - 使用目标位置实现平滑移动
        const head = this.snake[0];
        let moveSpeedFactor = Math.min(this.moveSpeed * 0.02, 1.0); // 限制最大移动速度
        
        // 如果蛇头眩晕，添加后仰效果
        let currentDirection = this.currentDirection;
        if (this.snakeStunned.isStunned) {
            // 眩晕时后仰（反方向移动）
            const stunProgress = this.snakeStunned.elapsed / this.snakeStunned.duration;
            if (stunProgress < 0.5) { // 前半段时间后仰
                currentDirection = this.currentDirection + Math.PI; // 反方向
                moveSpeedFactor *= 0.5; // 后仰速度较慢
            }
        }
        
        head.targetX += Math.cos(currentDirection) * moveSpeedFactor;
        head.targetY += Math.sin(currentDirection) * moveSpeedFactor;
        head.rotation = this.currentDirection;
        
        // 平滑插值到目标位置
        head.actualX += (head.targetX - head.actualX) * this.SMOOTH_FACTOR;
        head.actualY += (head.targetY - head.actualY) * this.SMOOTH_FACTOR;
        
        // 检查边界碰撞 - 蛇头出地图就游戏结束
        const minBoundary = 0;
        const maxBoundary = this.BOARD_SIZE * this.GRID_SIZE;
        
        // 直接检查边界，不阻拦移动
        if (head.actualX < minBoundary || head.actualX >= maxBoundary || 
            head.actualY < minBoundary || head.actualY >= maxBoundary) {
            this.gameOver();
            return;
        }
        
        // 检查是否靠近边界，显示警告墙体
        this.updateBoundaryWarning(head);
        
        // 更新网格位置
        head.x = Math.floor(head.actualX / this.GRID_SIZE);
        head.y = Math.floor(head.actualY / this.GRID_SIZE);
        
        // 更新障碍物系统
        this.updateObstacleSpawning();
        this.updateCameraShake();
        this.updateSnakeStun();
        this.updateInvulnerability();
        
        // 更新视觉效果
        this.updateVisualEffects();
        
        // 更新关卡系统
        this.updateLevelSystem();
        
        // 检查障碍物碰撞（在眩晕状态下也要检查）
        this.checkObstacleCollision();
        
        // 优化的自身碰撞检测（跳过前3个段避免误判）
        const collisionRadius = this.GRID_SIZE * 0.8;
        const collisionRadiusSq = collisionRadius * collisionRadius; // 使用平方距离避免开方运算
        
        for (let i = 3; i < this.snake.length; i++) {
            const segment = this.snake[i];
            const dx = head.actualX - segment.actualX;
            const dy = head.actualY - segment.actualY;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq < collisionRadiusSq) {
                this.gameOver();
                return;
            }
        }
        
        // 食物碰撞检测 - 使用实际坐标距离检测，只要蛇头碰到食物就算吃到
        const foodWorldX = this.food.x * this.GRID_SIZE;
        const foodWorldY = this.food.y * this.GRID_SIZE;
        const dx = head.actualX - foodWorldX;
        const dy = head.actualY - foodWorldY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const foodCollisionRadius = this.GRID_SIZE * 0.7; // 碰撞半径，比网格稍小以保持合理性
        
        if (distance < foodCollisionRadius) {
            // 连击机制
            const currentTime = Date.now();
            if (currentTime - this.lastFoodTime < 3000) { // 3秒内算连击
                this.comboCount++;
            } else {
                this.comboCount = 1;
            }
            this.lastFoodTime = currentTime;
            
            // 根据连击计算得分
            const baseScore = 10;
            const comboBonus = this.comboCount > 1 ? (this.comboCount - 1) * 5 : 0;
            const totalScore = baseScore + comboBonus;
            
            this.score += totalScore;
            this.updateScore();
            
            // 增加蛇的长度 - 复制蛇尾并添加到末尾
            const tail = this.snake[this.snake.length - 1];
            const newSegment = {
                x: tail.x,
                y: tail.y,
                actualX: tail.actualX,
                actualY: tail.actualY,
                targetX: tail.actualX,
                targetY: tail.actualY,
                rotation: tail.rotation
            };
            this.snake.push(newSegment);
            
            // 创建新的蛇段mesh
            this.createSnake();
            
            // 更新难度（根据新长度计算速度）
            this.updateDifficulty();
            
            // 更新障碍物颜色（因为蛇长度变化了）
            this.updateObstacleColors();
            
            // 生成新食物
            this.generateFood();
            
            console.log('🍎 食物被吃掉！蛇长度：', this.snake.length, '得分：+', totalScore, '连击：', this.comboCount, '当前速度：', this.moveSpeed.toFixed(1));
        }
        
        // 优化的蛇身跟随 - 平滑跟随
        const gridSizeSq = this.GRID_SIZE * this.GRID_SIZE;
        
        for (let i = 1; i < this.snake.length; i++) {
            const current = this.snake[i];
            const target = this.snake[i - 1];
            
            const dx = target.actualX - current.actualX;
            const dy = target.actualY - current.actualY;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq > gridSizeSq) {
                const distance = Math.sqrt(distanceSq); // 只有需要时才计算平方根
                const ratio = (distance - this.GRID_SIZE) / distance * 0.8; // 减少跟随速度
                current.targetX = current.actualX + dx * ratio;
                current.targetY = current.actualY + dy * ratio;
            }
            
            // 平滑插值到目标位置
            current.actualX += (current.targetX - current.actualX) * this.SMOOTH_FACTOR;
            current.actualY += (current.targetY - current.actualY) * this.SMOOTH_FACTOR;
            current.x = Math.floor(current.actualX / this.GRID_SIZE);
            current.y = Math.floor(current.actualY / this.GRID_SIZE);
        }
        
        // 更新蛇的3D模型位置
        this.updateSnakePositions();
        
        // 在所有物体位置更新完成后，再更新相机位置
        this.updateCameraTarget();
    }
    
    updateCameraTarget() {
        const headWorldPos = this.getSnakeHeadWorldPosition();
        
        // 更新相机目标位置
        this.cameraTarget.position.copy(headWorldPos);
        
        // 更新第三人称相机
        this.thirdPersonCamera.update();
        
        // 更新点光源位置
        this.snakeLight.position.copy(headWorldPos);
        this.snakeLight.position.y = 10;
    }
    
    gameOver() {
        // 检查是否在关卡模式下
        if (this.levelSystem.isActive && !this.levelSystem.completed && !this.levelSystem.failed) {
            // 在关卡模式下，调用关卡失败
            console.log('💥 关卡模式下游戏结束，触发关卡失败');
            this.levelFailed('撞墙或撞到自己！');
            return;
        }
        
        // 普通游戏结束
        this.gameState = 'gameOver';
        this.statusElement.textContent = `游戏结束！得分: ${this.score}`;
        this.statusElement.className = 'game-over';
        
        // 添加游戏结束视觉效果
        this.flashScreenColor(0xFF6B6B, 0.5, 500); // 温暖的红色，不太刺眼
        this.startCameraShake(1.2, 600);
        
        // 隐藏所有警告墙体
        this.hideAllWarningWalls();
        
        // 清理所有障碍物
        this.clearAllObstacles();
        
        // 重置相机抖动和眩晕状态
        this.cameraShake.isShaking = false;
        this.snakeStunned.isStunned = false;
        
        // 显示游戏结束对话框
        setTimeout(() => {
            this.showGameOverDialog();
        }, 1000);
    }
    
    updateScore() {
        this.scoreElement.textContent = this.score;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // 清理所有mesh资源（用于游戏结束或重新初始化）
    cleanup() {
        // 清理蛇的mesh池
        this.meshPool.headMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
        this.meshPool.bodyMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
        // 清理食物mesh
        if (this.foodMesh) {
            this.scene.remove(this.foodMesh);
            this.foodMesh.geometry.dispose();
            this.foodMesh.material.dispose();
        }
        
        // 清理警告墙体
        Object.values(this.warningWalls).forEach(wall => {
            if (wall) {
                this.scene.remove(wall);
                wall.geometry.dispose();
                wall.material.dispose();
            }
        });
        
        // 清理障碍物
        this.obstacles.forEach(obstacle => {
            this.scene.remove(obstacle.mesh);
            this.scene.remove(obstacle.shadowMesh);
            // 清理障碍物的独立材质
            obstacle.mesh.material.dispose();
            obstacle.shadowMesh.material.dispose();
            // 注意：obstacle.mesh使用的是共享的geometry，不需要dispose
        });
        
        // 重置mesh池
        this.meshPool = {
            headMeshes: [],
            bodyMeshes: [],
            usedHeadMeshes: 0,
            usedBodyMeshes: 0
        };
        
        this.snakeMeshes = [];
        this.foodMesh = null;
        this.obstacles = [];
        this.warningWalls = {
            top: null,
            bottom: null,
            left: null,
            right: null
        };
        
        console.log('游戏资源已清理');
    }
    
    // 障碍物系统方法
    
    // 生成障碍物
    generateObstacle() {
        // 检查是否达到最大障碍物数量
        if (this.obstacles.length >= this.maxObstacles) {
            return;
        }
        
        // 随机生成位置，确保不与蛇身和食物重叠
        let position;
        let attempts = 0;
        do {
            position = {
                x: Math.floor(Math.random() * this.BOARD_SIZE),
                y: Math.floor(Math.random() * this.BOARD_SIZE)
            };
            attempts++;
        } while (this.isPositionOccupied(position.x, position.y) && attempts < 50);
        
        if (attempts >= 50) {
            console.log('无法找到合适的障碍物位置');
            return;
        }
        
        // 生成障碍物等级和类型
        const obstacleInfo = this.generateObstacleLevel();
        const obstacleTypeConfig = this.obstacleTypes[obstacleInfo.type];
        
        // 根据类型创建对应的几何体
        let obstacleGeometry;
        switch (obstacleTypeConfig.geometry) {
            case 'box':
                obstacleGeometry = new THREE.BoxGeometry(this.GRID_SIZE * 0.6, this.GRID_SIZE * 0.6, this.GRID_SIZE * 0.6);
                break;
            case 'octahedron':
                obstacleGeometry = new THREE.OctahedronGeometry(this.GRID_SIZE * 0.4);
                break;
            case 'tetrahedron':
                obstacleGeometry = new THREE.TetrahedronGeometry(this.GRID_SIZE * 0.5);
                break;
            case 'sphere':
                obstacleGeometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.4, 16, 16);
                break;
            default:
                obstacleGeometry = this.obstacleGeometry;
        }
        
        // 根据类型创建对应的材质
        const obstacleMaterial = new THREE.MeshPhongMaterial({ 
            color: obstacleTypeConfig.color,
            shininess: 80,
            emissive: obstacleTypeConfig.emissive
        });
        
        // 创建阴影材质
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.3
        });
        
        // 创建地面阴影
        const shadowGeometry = new THREE.CircleGeometry(this.GRID_SIZE * 0.4, 16);
        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(
            position.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0.1, // 略高于地面
            position.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        // 预判碰撞结果
        const snakeLength = this.snake.length;
        const willGetReward = snakeLength >= obstacleInfo.level;
        
        // 根据预判结果调整材质
        if (willGetReward) {
            // 奖励状态：添加金色光环
            obstacleMaterial.emissive.multiplyScalar(1.5);
            obstacleMaterial.emissiveIntensity = 0.8;
        } else {
            // 惩罚状态：添加红色警告
            const warningColor = new THREE.Color(0.3, 0, 0);
            obstacleMaterial.emissive.add(warningColor);
        }
        
        // 创建障碍物
        const obstacle = {
            x: position.x,
            y: position.y,
            level: obstacleInfo.level,
            type: obstacleInfo.type,
            effect: obstacleTypeConfig.effect,
            mesh: new THREE.Mesh(obstacleGeometry, obstacleMaterial),
            shadowMesh: shadowMesh,
            id: Date.now() + Math.random(), // 唯一ID
            // 下落动画相关
            isFalling: true,
            fallSpeed: 0,
            targetY: this.GRID_SIZE / 2,
            startY: this.GRID_SIZE * 8, // 从高空开始
            hasLanded: false,
            // 旋转动画
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02,
                z: (Math.random() - 0.5) * 0.02
            },
            // 碰撞预判
            willGetReward: willGetReward,
            originalEmissive: obstacleTypeConfig.emissive
        };
        
        // 设置障碍物初始位置（从天空开始）
        obstacle.mesh.position.set(
            position.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            obstacle.startY,  // 从高空开始
            position.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        obstacle.mesh.castShadow = true;
        
        this.obstacles.push(obstacle);
        this.scene.add(obstacle.mesh);
        this.scene.add(obstacle.shadowMesh);
        
        console.log('🌟 生成障碍物:', position.x, position.y, '类型:', obstacleInfo.type, '等级:', obstacleInfo.level, '蛇长度:', this.snake.length, '从天而降中... 当前障碍物数量:', this.obstacles.length);
    }
    
    // 检查位置是否被占用
    isPositionOccupied(x, y) {
        // 检查是否与蛇身重叠
        for (let segment of this.snake) {
            if (segment.x === x && segment.y === y) {
                return true;
            }
        }
        
        // 检查是否与食物重叠
        if (this.food.x === x && this.food.y === y) {
            return true;
        }
        
        // 检查是否与其他障碍物重叠
        for (let obstacle of this.obstacles) {
            if (obstacle.x === x && obstacle.y === y) {
                return true;
            }
        }
        
        return false;
    }
    
    // 更新障碍物生成
    updateObstacleSpawning() {
        if (this.gameState !== 'playing') return;
        
        const currentTime = Date.now();
        
        // 检查是否到了生成下一个障碍物的时间
        if (currentTime >= this.nextObstacleTime) {
            this.generateObstacle();
            this.scheduleNextObstacle();
        }
    }
    
    // 安排下一个障碍物的生成时间
    scheduleNextObstacle() {
        // 根据游戏难度调整生成频率
        const difficultyMultiplier = this.getDifficultyMultiplier();
        const minInterval = this.obstacleMinInterval / difficultyMultiplier;
        const maxInterval = this.obstacleMaxInterval / difficultyMultiplier;
        
        const interval = minInterval + Math.random() * (maxInterval - minInterval);
        this.nextObstacleTime = Date.now() + interval;
        
        console.log('下一个障碍物将在', (interval / 1000).toFixed(1), '秒后生成，难度倍数:', difficultyMultiplier.toFixed(2));
    }
    
    // 获取难度倍数
    getDifficultyMultiplier() {
        const baseMultiplier = 1.0;
        const lengthBonus = (this.snake.length - 3) * 0.1; // 每增加一段，生成频率增加10%
        const scoreBonus = this.score * 0.001; // 每10分，生成频率增加1%
        
        return Math.max(baseMultiplier + lengthBonus + scoreBonus, 0.3); // 最少是原来的3倍频率
    }
    
    // 检查障碍物碰撞
    checkObstacleCollision() {
        // 如果处于无敌状态，跳过碰撞检测
        if (this.isInvulnerable) {
            return false;
        }
        
        const head = this.snake[0];
        const collisionRadius = this.GRID_SIZE * 0.7;
        
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            
            // 只有已落地的障碍物才能被碰撞
            if (!obstacle.hasLanded) {
                continue;
            }
            
            const obstacleWorldX = obstacle.x * this.GRID_SIZE;
            const obstacleWorldY = obstacle.y * this.GRID_SIZE;
            
            const dx = head.actualX - obstacleWorldX;
            const dy = head.actualY - obstacleWorldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < collisionRadius) {
                // 碰撞发生
                this.handleObstacleCollision(obstacle, i);
                return true;
            }
        }
        
        return false;
    }
    
    // 处理障碍物碰撞
    handleObstacleCollision(obstacle, index) {
        const snakeLength = this.snake.length;
        const obstacleLevel = obstacle.level;
        
        console.log('碰撞障碍物！蛇长度:', snakeLength, '障碍物类型:', obstacle.type, '等级:', obstacleLevel);
        
        // 移除障碍物（不管结果如何，障碍物都会消失）
        this.scene.remove(obstacle.mesh);
        this.scene.remove(obstacle.shadowMesh);
        this.clearObstaclePreview(obstacle); // 清理预览文字
        this.obstacles.splice(index, 1);
        
        // 根据障碍物类型和蛇长度关系决定效果
        if (snakeLength >= obstacleLevel) {
            // 蛇长度 >= 障碍物等级，获得奖励
            this.handleObstacleReward(obstacle, snakeLength, obstacleLevel);
        } else {
            // 蛇长度 < 障碍物等级，受到惩罚
            this.handleObstaclePenalty(obstacle, snakeLength, obstacleLevel);
        }
        
        // 重新创建蛇的mesh
        this.createSnake();
        
        // 更新难度（因为蛇长度变化了）
        this.updateDifficulty();
        
        // 更新障碍物颜色（因为蛇长度变化了）
        this.updateObstacleColors();
    }
    
    // 处理障碍物奖励
    handleObstacleReward(obstacle, snakeLength, obstacleLevel) {
        console.log('🎉 ✅ 成功击破障碍物！获得奖励');
        
        // 显示奖励特效
        this.showRewardEffect(obstacle);
        
        // 根据障碍物类型给予不同奖励
        switch (obstacle.effect) {
            case 'stun':
                // 弱障碍物：得分奖励
                this.score += 20;
                this.showFloatingText('+20分', obstacle, 0xFFD700); // 金黄色，庆祝感
                console.log('💰 得分奖励 +20');
                break;
            case 'shrink':
                // 普通障碍物：增加连击
                this.comboCount++;
                this.score += 30 * this.comboCount;
                this.showFloatingText(`连击 x${this.comboCount}`, obstacle, 0xFFE135); // 明亮黄色，阳光感
                console.log('🔥 连击奖励 +', 30 * this.comboCount);
                break;
            case 'halve':
                // 强障碍物：增加蛇长度
                this.snake.push(this.createNewSnakeSegment());
                this.score += 50;
                this.showFloatingText('蛇身+1', obstacle, 0x74C0FC); // 天蓝色，梦幻感
                console.log('🐍 蛇长度增加 +1, 得分 +50');
                break;
            case 'teleport':
                // 特殊障碍物：激活无敌状态
                this.activateSafetyBuff(this.DIFFICULTY_CONFIG.safetyBuffDuration);
                this.score += 100;
                this.showFloatingText('无敌状态!', obstacle, 0xDDA0DD); // 淡紫色，神奇感
                console.log('🛡️ 无敌状态激活，得分 +100');
                break;
        }
        
        // 正面震动和音效提示
        this.startCameraShake(0.5, 200);
        this.flashScreenColor(0xFFD700, 0.3, 150); // 金黄色闪烁，庆祝感
    }
    
    // 处理障碍物惩罚
    handleObstaclePenalty(obstacle, snakeLength, obstacleLevel) {
        console.log('💥 ❌ 碰撞障碍物！受到惩罚');
        console.log(`😵 蛇长度 ${snakeLength} < 障碍物等级 ${obstacleLevel}`);
        
        // 显示惩罚特效
        this.showPenaltyEffect(obstacle);
        
        let newLength = snakeLength;
        
        // 根据障碍物类型给予不同惩罚
        switch (obstacle.effect) {
            case 'stun':
                // 弱障碍物：短暂眩晕
                this.startSnakeStun(800);
                this.showFloatingText('眩晕!', obstacle, 0xFFA500); // 橙色，温和的警告
                console.log('😵 短暂眩晕');
                break;
            case 'shrink':
                // 普通障碍物：减少1-2段
                newLength = Math.max(3, snakeLength - Math.floor(Math.random() * 2) - 1);
                this.showFloatingText(`-${snakeLength - newLength}段`, obstacle, 0xFF6B6B); // 温暖的红色，不太刺眼
                console.log(`📉 蛇长度: ${snakeLength} → ${newLength}`);
                break;
            case 'halve':
                // 强障碍物：减半
                newLength = Math.max(3, Math.floor(snakeLength / 2));
                this.showFloatingText('减半!', obstacle, 0xFF6B6B); // 温暖的红色，不太刺眼
                console.log(`📉 蛇长度: ${snakeLength} → ${newLength}`);
                break;
            case 'teleport':
                // 特殊障碍物：随机传送蛇头
                this.teleportSnakeHead();
                this.showFloatingText('传送!', obstacle, 0xDDA0DD); // 淡紫色，神奇感
                console.log('🌀 蛇头被传送');
                break;
        }
        
        // 应用长度变化
        if (newLength < snakeLength) {
            this.snake = this.snake.slice(0, newLength);
        }
        
        // 重置连击
        this.comboCount = 0;
        
        // 检查是否需要安全期
        if (newLength <= this.DIFFICULTY_CONFIG.minSafeLength) {
            this.activateSafetyBuff(this.DIFFICULTY_CONFIG.safetyBuffDuration);
            console.log('🛡️ 触发安全期保护');
        }
        
        // 触发相机抖动和负面视觉效果
        this.startCameraShake(1.0, 400);
        this.flashScreenColor(0xFF6B6B, 0.5, 300); // 温暖的红色闪烁，不太刺眼
        
        // 触发蛇头眩晕
        this.startSnakeStun(600);
    }
    
    // 开始相机抖动
    startCameraShake(intensity, duration) {
        this.cameraShake.isShaking = true;
        this.cameraShake.intensity = intensity;
        this.cameraShake.duration = duration;
        this.cameraShake.elapsed = 0;
    }
    
    // 开始蛇头眩晕
    startSnakeStun(duration) {
        this.snakeStunned.isStunned = true;
        this.snakeStunned.duration = duration;
        this.snakeStunned.elapsed = 0;
        this.snakeStunned.originalSpeed = this.moveSpeed;
        
        // 眩晕期间减速
        this.moveSpeed *= 0.3;
    }
    
    // 激活安全期保护
    activateSafetyBuff(duration) {
        this.isInvulnerable = true;
        this.invulnerableEndTime = Date.now() + duration;
        
        // 视觉效果：蛇头材质变为温暖的金色发光
        if (this.snakeMeshes[0]) {
            this.snakeMeshes[0].material.emissive.setHex(0x664400);
        }
        
        console.log('🛡️ 安全期激活，持续', duration / 1000, '秒');
    }
    
    // 创建新的蛇身段
    createNewSnakeSegment() {
        const tail = this.snake[this.snake.length - 1];
        return {
            x: tail.x,
            y: tail.y,
            actualX: tail.actualX,
            actualY: tail.actualY,
            targetX: tail.actualX,
            targetY: tail.actualY,
            rotation: tail.rotation
        };
    }
    
    // 传送蛇头到随机位置
    teleportSnakeHead() {
        const head = this.snake[0];
        let newX, newY;
        let attempts = 0;
        
        // 尝试找到一个安全的传送位置
        do {
            newX = Math.floor(Math.random() * this.BOARD_SIZE);
            newY = Math.floor(Math.random() * this.BOARD_SIZE);
            attempts++;
        } while (this.isPositionOccupied(newX, newY) && attempts < 50);
        
        if (attempts < 50) {
            head.x = newX;
            head.y = newY;
            head.actualX = newX * this.GRID_SIZE;
            head.actualY = newY * this.GRID_SIZE;
            head.targetX = head.actualX;
            head.targetY = head.actualY;
            
            // 传送特效
            this.startCameraShake(0.8, 300);
            console.log('🌀 蛇头传送到:', newX, newY);
        }
    }
    
    // 更新相机抖动
    updateCameraShake() {
        if (!this.cameraShake.isShaking) return;
        
        this.cameraShake.elapsed += 16; // 假设60FPS
        
        if (this.cameraShake.elapsed >= this.cameraShake.duration) {
            this.cameraShake.isShaking = false;
            // 重置第三人称相机的抖动偏移
            this.thirdPersonCamera.shakeOffset = null;
            return;
        }
        
        // 计算抖动强度（随时间衰减）
        const progress = this.cameraShake.elapsed / this.cameraShake.duration;
        const currentIntensity = this.cameraShake.intensity * (1 - progress);
        
        // 应用随机抖动偏移到第三人称相机
        const shakeX = (Math.random() - 0.5) * currentIntensity * 8;
        const shakeY = (Math.random() - 0.5) * currentIntensity * 8;
        const shakeZ = (Math.random() - 0.5) * currentIntensity * 8;
        
        // 为第三人称相机添加抖动偏移
        if (!this.thirdPersonCamera.shakeOffset) {
            this.thirdPersonCamera.shakeOffset = new THREE.Vector3();
        }
        
        this.thirdPersonCamera.shakeOffset.set(shakeX, shakeY, shakeZ);
    }
    
    // 更新蛇头眩晕
    updateSnakeStun() {
        if (!this.snakeStunned.isStunned) return;
        
        this.snakeStunned.elapsed += 16; // 假设60FPS
        
        if (this.snakeStunned.elapsed >= this.snakeStunned.duration) {
            // 眩晕结束，恢复速度
            this.snakeStunned.isStunned = false;
            this.moveSpeed = this.snakeStunned.originalSpeed;
            console.log('眩晕结束，速度恢复');
        }
    }
    
    // 更新无敌状态
    updateInvulnerability() {
        if (!this.isInvulnerable) return;
        
        const currentTime = Date.now();
        if (currentTime >= this.invulnerableEndTime) {
            // 无敌状态结束
            this.isInvulnerable = false;
            
            // 恢复蛇头材质
            if (this.snakeMeshes[0]) {
                this.snakeMeshes[0].material.emissive.setHex(0x441100);
            }
            
            console.log('🛡️ 安全期结束');
        } else {
            // 闪烁效果
            const remaining = this.invulnerableEndTime - currentTime;
            const flashRate = remaining < 1000 ? 0.1 : 0.3; // 剩余时间少时闪烁更快
            const flash = Math.sin(currentTime * flashRate) > 0;
            
            if (this.snakeMeshes[0]) {
                this.snakeMeshes[0].material.emissive.setHex(flash ? 0x664400 : 0x441100);
            }
        }
    }
    
    // 清理所有障碍物
    clearAllObstacles() {
        this.obstacles.forEach(obstacle => {
            this.scene.remove(obstacle.mesh);
            this.scene.remove(obstacle.shadowMesh);
            this.clearObstaclePreview(obstacle); // 清理预览文字
        });
        this.obstacles = [];
        this.nextObstacleTime = 0;
    }
    
    // 更新障碍物显示（包含下落动画）
    updateObstacleDisplay() {
        this.obstacles.forEach((obstacle, index) => {
            // 应用旋转动画
            if (obstacle.rotationSpeed) {
                obstacle.mesh.rotation.x += obstacle.rotationSpeed.x;
                obstacle.mesh.rotation.y += obstacle.rotationSpeed.y;
                obstacle.mesh.rotation.z += obstacle.rotationSpeed.z;
            }
            
            // 根据类型添加特殊效果
            if (obstacle.type === 'SPECIAL') {
                // 特殊障碍物：悬浮效果
                const time = Date.now() * 0.003;
                obstacle.mesh.position.y = obstacle.targetY + Math.sin(time + obstacle.id) * 2;
            }
            
            // 添加预览指示器
            if (obstacle.hasLanded) {
                this.updateObstaclePreview(obstacle);
            }
            
            if (obstacle.isFalling) {
                // 更新下落动画
                obstacle.fallSpeed += 0.5; // 重力加速度
                obstacle.mesh.position.y -= obstacle.fallSpeed;
                
                // 根据高度调整阴影大小和透明度
                const height = obstacle.mesh.position.y;
                const progress = Math.max(0, (obstacle.startY - height) / (obstacle.startY - obstacle.targetY));
                
                // 阴影随着障碍物接近地面而变大变暗
                const shadowScale = 0.5 + progress * 0.5; // 从0.5到1.0
                const shadowOpacity = 0.1 + progress * 0.3; // 从0.1到0.4
                
                obstacle.shadowMesh.scale.set(shadowScale, shadowScale, 1);
                obstacle.shadowMesh.material.opacity = shadowOpacity;
                
                // 检查是否落地
                if (obstacle.mesh.position.y <= obstacle.targetY) {
                    obstacle.mesh.position.y = obstacle.targetY;
                    obstacle.isFalling = false;
                    obstacle.hasLanded = true;
                    
                    // 落地时阴影达到最大值
                    obstacle.shadowMesh.scale.set(1, 1, 1);
                    obstacle.shadowMesh.material.opacity = 0.4;
                    
                    // 落地震动效果
                    this.startCameraShake(1.0, 400); // 强度1.0，持续400毫秒
                    
                    console.log('💥 障碍物落地震动！类型:', obstacle.type);
                }
            } else if (obstacle.hasLanded) {
                // 已落地的障碍物：脉冲效果
                const time = Date.now() * 0.005;
                const pulse = 1 + Math.sin(time + obstacle.id) * 0.1;
                obstacle.mesh.scale.set(pulse, pulse, pulse);
                
                // 危险障碍物额外发光
                if (obstacle.type === 'STRONG') {
                    const glowIntensity = 0.5 + Math.sin(time * 2) * 0.3;
                    obstacle.mesh.material.emissiveIntensity = glowIntensity;
                }
            }
        });
    }
    
    // 动态更新所有障碍物的危险等级和颜色
    updateObstacleColors() {
        const snakeLength = this.snake.length;
        
        this.obstacles.forEach(obstacle => {
            const willGetReward = snakeLength >= obstacle.level;
            
            // 重置材质发光效果
            obstacle.mesh.material.emissive.setHex(obstacle.originalEmissive);
            obstacle.mesh.material.emissiveIntensity = 1.0;
            
            // 根据当前蛇长度重新判断奖励/惩罚状态
            if (willGetReward !== obstacle.willGetReward) {
                obstacle.willGetReward = willGetReward;
                
                if (willGetReward) {
                    // 变为奖励状态：添加金色光环
                    obstacle.mesh.material.emissive.multiplyScalar(1.5);
                    obstacle.mesh.material.emissiveIntensity = 0.8;
                    console.log(`障碍物 ${obstacle.type} 变为奖励状态`);
                } else {
                    // 变为惩罚状态：添加红色警告
                    const warningColor = new THREE.Color(0.3, 0, 0);
                    obstacle.mesh.material.emissive.add(warningColor);
                    console.log(`障碍物 ${obstacle.type} 变为惩罚状态`);
                }
            }
        });
    }
    
    // 更新障碍物预览效果
    updateObstaclePreview(obstacle) {
        const time = Date.now() * 0.008;
        
        // 根据奖励/惩罚状态添加不同的预览效果
        if (obstacle.willGetReward) {
            // 奖励状态：金色光环脉冲
            const pulse = 1 + Math.sin(time) * 0.3;
            obstacle.mesh.material.emissiveIntensity = 0.8 * pulse;
            
            // 创建预览文字（如果还没有）
            if (!obstacle.previewText) {
                this.createObstaclePreview(obstacle, '奖励!', 0xFFD700); // 金黄色，庆祝感
            }
        } else {
            // 惩罚状态：红色警告闪烁
            const flash = Math.sin(time * 2) > 0 ? 1 : 0.5;
            obstacle.mesh.material.emissiveIntensity = flash;
            
            // 创建预览文字（如果还没有）
            if (!obstacle.previewText) {
                this.createObstaclePreview(obstacle, '危险!', 0xFF6B6B); // 温暖的红色，不太刺眼
            }
        }
    }
    
    // 创建障碍物预览指示器
    createObstaclePreview(obstacle, text, color) {
        // 创建简单的文字指示器
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 32;
        
        // 绘制文字
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 64, 16);
        
        // 创建纹理和材质
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const geometry = new THREE.PlaneGeometry(4, 1);
        const textMesh = new THREE.Mesh(geometry, material);
        
        // 设置位置（在障碍物上方）
        textMesh.position.set(
            obstacle.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE * 1.5,
            obstacle.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        // 面向相机
        textMesh.lookAt(this.camera.position);
        
        this.scene.add(textMesh);
        obstacle.previewText = textMesh;
    }
    
    // 清理障碍物预览
    clearObstaclePreview(obstacle) {
        if (obstacle.previewText) {
            this.scene.remove(obstacle.previewText);
            obstacle.previewText.geometry.dispose();
            obstacle.previewText.material.dispose();
            obstacle.previewText = null;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        
        // 帧率限制 - 只在达到目标帧间隔时才渲染
        if (deltaTime >= this.frameInterval) {
            // 更新性能监视器
            this.stats.begin();
            
            // 添加食物旋转动画（使用deltaTime实现帧率无关的动画）
            if (this.foodMesh) {
                this.foodMesh.rotation.y += 0.02 * (deltaTime / 16.67); // 标准化到60fps
                this.foodMesh.position.y = this.GRID_SIZE / 2 + Math.sin(currentTime * 0.005) * 3;
            }
            
            // 更新障碍物显示
            this.updateObstacleDisplay();
            
            this.renderer.render(this.scene, this.camera);
            
            // 结束性能监视器计时
            this.stats.end();
            
            this.lastUpdateTime = currentTime - (deltaTime % this.frameInterval);
        }
    }
}

// 初始化游戏
const game = new SnakeGame();
// 将游戏对象暴露到全局，以便HTML按钮可以调用
window.game = game; 