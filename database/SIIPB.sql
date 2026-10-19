/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.20-13.0.2-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: siipb
-- ------------------------------------------------------
-- Server version	13.0.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `alembic_version`
--

DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alembic_version`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `alembic_version` WRITE;
/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
INSERT INTO `alembic_version` VALUES
('d4e8b1a5f920');
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `asset_history`
--

DROP TABLE IF EXISTS `asset_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` bigint(20) unsigned NOT NULL,
  `changed_by` bigint(20) unsigned DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `old_status` varchar(30) DEFAULT NULL,
  `new_status` varchar(30) DEFAULT NULL,
  `old_location_id` bigint(20) unsigned DEFAULT NULL,
  `new_location_id` bigint(20) unsigned DEFAULT NULL,
  `old_condition` varchar(30) DEFAULT NULL,
  `new_condition` varchar(30) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`)),
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_asset_history_asset_id_created_at` (`asset_id`,`created_at`),
  KEY `ix_asset_history_changed_by` (`changed_by`),
  KEY `ix_asset_history_created_at` (`created_at`),
  KEY `ix_asset_history_event_type` (`event_type`),
  KEY `ix_asset_history_new_location_id` (`new_location_id`),
  KEY `ix_asset_history_old_location_id` (`old_location_id`),
  CONSTRAINT `fk_asset_history_asset_id_assets` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_asset_history_changed_by_users` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_history_new_location_id_locations` FOREIGN KEY (`new_location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_asset_history_old_location_id_locations` FOREIGN KEY (`old_location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_history`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `asset_history` WRITE;
/*!40000 ALTER TABLE `asset_history` DISABLE KEYS */;
INSERT INTO `asset_history` VALUES
(1,6,1,'CREATED',NULL,'TERSEDIA',NULL,1,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-75C5C1\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-a118eeff\", \"status\": \"TERSEDIA\"}','2026-10-06 10:42:47.759462'),
(2,7,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-001\", \"name\": \"Duplicate Asset Test\"}','2026-10-06 10:42:47.788713'),
(3,8,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-CA1EA2\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','2026-10-06 10:42:48.117095'),
(4,8,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104248 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:42:48.138924'),
(5,10,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-RET-D82417\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','2026-10-06 10:42:48.450781'),
(6,11,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DMG-608E92\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','2026-10-06 10:42:49.143858'),
(7,11,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104249 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:42:49.158650'),
(8,12,1,'CREATED',NULL,'TERSEDIA',NULL,1,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-70D665\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-fab39880\", \"status\": \"TERSEDIA\"}','2026-10-06 10:43:47.612702'),
(9,13,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DUP-6BEB3B\", \"name\": \"Original Asset Test\"}','2026-10-06 10:43:47.638725'),
(10,14,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-AB2A2C\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','2026-10-06 10:43:47.703019'),
(11,14,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104347-A056 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:43:47.723342'),
(12,15,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104347-D5B6 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:43:47.792487'),
(13,16,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-RET-EBAF53\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','2026-10-06 10:43:47.881273'),
(14,16,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104347-5380 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:43:47.896121'),
(15,16,1,'RETURNED_GOOD','DIPINJAM','TERSEDIA',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi baik (TX: TX-20261006104347-5380)',NULL,NULL,'2026-10-06 10:43:47.927298'),
(16,17,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DMG-BEAF01\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','2026-10-06 10:43:48.366191'),
(17,17,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104348-4B52 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:43:48.379936'),
(18,17,1,'RETURNED_DAMAGED','DIPINJAM','RUSAK',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi rusak (TX: TX-20261006104348-4B52)',NULL,NULL,'2026-10-06 10:43:48.405783'),
(19,18,1,'CREATED',NULL,'TERSEDIA',NULL,1,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-975855\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-76243040\", \"status\": \"TERSEDIA\"}','2026-10-06 10:44:33.919571'),
(20,19,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DUP-2D2572\", \"name\": \"Original Asset Test\"}','2026-10-06 10:44:33.944745'),
(21,20,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-14FA93\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','2026-10-06 10:44:34.007250'),
(22,20,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104434-7336 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:44:34.025946'),
(23,21,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104434-8D1B oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:44:34.095919'),
(24,22,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-RET-CCE8BE\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','2026-10-06 10:44:34.191905'),
(25,22,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104434-9443 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:44:34.206075'),
(26,22,1,'RETURNED_GOOD','DIPINJAM','TERSEDIA',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi baik (TX: TX-20261006104434-9443)',NULL,NULL,'2026-10-06 10:44:34.231084'),
(27,23,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DMG-C38512\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','2026-10-06 10:44:34.265624'),
(28,23,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006104434-4D6B oleh Ahmad Pratama',NULL,NULL,'2026-10-06 10:44:34.278483'),
(29,23,1,'RETURNED_DAMAGED','DIPINJAM','RUSAK',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi rusak (TX: TX-20261006104434-4D6B)',NULL,NULL,'2026-10-06 10:44:34.302289'),
(30,23,1,'REPAIR_COMPLETED','RUSAK','TERSEDIA',NULL,NULL,NULL,NULL,'Perbaikan selesai untuk laporan #2',NULL,NULL,'2026-10-06 10:44:34.326582'),
(31,24,1,'CREATED',NULL,'TERSEDIA',NULL,1,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-2F3DBC\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-27ad843b\", \"status\": \"TERSEDIA\"}','2026-10-06 11:54:49.178335'),
(32,25,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DUP-622DC8\", \"name\": \"Original Asset Test\"}','2026-10-06 11:54:49.202155'),
(33,26,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-998D68\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','2026-10-06 11:54:49.270429'),
(34,26,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006115449-FD03 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 11:54:49.291839'),
(35,27,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006115449-6AB9 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 11:54:49.355685'),
(36,28,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-RET-C7B152\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','2026-10-06 11:54:49.511483'),
(37,28,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006115449-C74D oleh Ahmad Pratama',NULL,NULL,'2026-10-06 11:54:49.531353'),
(38,28,1,'RETURNED_GOOD','DIPINJAM','TERSEDIA',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi baik (TX: TX-20261006115449-C74D)',NULL,NULL,'2026-10-06 11:54:49.588799'),
(39,29,1,'CREATED',NULL,'TERSEDIA',NULL,NULL,NULL,'BAIK','Pendaftaran barang baru ke inventaris',NULL,'{\"category_id\": 1, \"inventory_code\": \"AST-DMG-588CF6\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','2026-10-06 11:54:49.627272'),
(40,29,1,'CHECKOUT','TERSEDIA','DIPINJAM',NULL,NULL,NULL,NULL,'Dipinjam pada transaksi TX-20261006115449-FA56 oleh Ahmad Pratama',NULL,NULL,'2026-10-06 11:54:49.637154'),
(41,29,1,'RETURNED_DAMAGED','DIPINJAM','RUSAK',NULL,NULL,NULL,NULL,'Dikembalikan dalam kondisi rusak (TX: TX-20261006115449-FA56)',NULL,NULL,'2026-10-06 11:54:49.658805'),
(42,29,1,'REPAIR_COMPLETED','RUSAK','TERSEDIA',NULL,NULL,NULL,NULL,'Perbaikan selesai untuk laporan #3',NULL,NULL,'2026-10-06 11:54:49.677642');
/*!40000 ALTER TABLE `asset_history` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `asset_incident_reports`
--

DROP TABLE IF EXISTS `asset_incident_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_incident_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `return_item_id` bigint(20) unsigned NOT NULL,
  `reported_by` bigint(20) unsigned NOT NULL,
  `incident_type` varchar(30) NOT NULL,
  `severity` varchar(30) DEFAULT NULL,
  `description` text NOT NULL,
  `evidence_path` varchar(500) DEFAULT NULL,
  `action_taken` text DEFAULT NULL,
  `repair_status` varchar(30) NOT NULL DEFAULT 'DILAPORKAN',
  `repair_cost` decimal(15,2) DEFAULT NULL,
  `reported_at` datetime(6) NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_asset_incident_reports_return_item_id_incident_type` (`return_item_id`,`incident_type`),
  KEY `ix_asset_incident_reports_incident_type` (`incident_type`),
  KEY `ix_asset_incident_reports_repair_status` (`repair_status`),
  KEY `ix_asset_incident_reports_reported_at` (`reported_at`),
  KEY `ix_asset_incident_reports_reported_by` (`reported_by`),
  KEY `ix_asset_incident_reports_return_item_id` (`return_item_id`),
  CONSTRAINT `fk_asset_incident_reports_reported_by_users` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_asset_incident_reports_return_item_id_return_items` FOREIGN KEY (`return_item_id`) REFERENCES `return_items` (`id`),
  CONSTRAINT `ck_asset_incident_reports_ck_asset_incident_reports_inci_ae59` CHECK (`incident_type` in ('KERUSAKAN','KEHILANGAN')),
  CONSTRAINT `ck_asset_incident_reports_ck_asset_incident_reports_severity` CHECK (`severity` is null or `severity` in ('RINGAN','SEDANG','BERAT')),
  CONSTRAINT `ck_asset_incident_reports_ck_asset_incident_reports_repa_c601` CHECK (`repair_status` in ('DILAPORKAN','DALAM_PERBAIKAN','SELESAI','TIDAK_DAPAT_DIPERBAIKI')),
  CONSTRAINT `ck_asset_incident_reports_ck_asset_incident_reports_repa_ba1d` CHECK (`repair_cost` is null or `repair_cost` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_incident_reports`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `asset_incident_reports` WRITE;
/*!40000 ALTER TABLE `asset_incident_reports` DISABLE KEYS */;
INSERT INTO `asset_incident_reports` VALUES
(1,2,1,'KERUSAKAN','SEDANG','Engsel laptop retak saat pemakaian',NULL,NULL,'DILAPORKAN',250000.00,'2026-10-06 10:43:48.392210',NULL,'2026-10-06 10:43:48.403882','2026-10-06 10:43:48.403882'),
(2,4,1,'KERUSAKAN','SEDANG','Engsel laptop retak saat pemakaian',NULL,'Engsel diganti baru','SELESAI',250000.00,'2026-10-06 10:44:34.289447','2026-10-06 10:44:34.320645','2026-10-06 10:44:34.300894','2026-10-06 10:44:34.327896'),
(3,6,1,'KERUSAKAN','SEDANG','Engsel laptop retak saat pemakaian',NULL,'Engsel diganti baru','SELESAI',250000.00,'2026-10-06 11:54:49.648145','2026-10-06 11:54:49.672179','2026-10-06 11:54:49.657882','2026-10-06 11:54:49.678760');
/*!40000 ALTER TABLE `asset_incident_reports` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `asset_photos`
--

DROP TABLE IF EXISTS `asset_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` bigint(20) unsigned NOT NULL,
  `path` varchar(500) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_asset_photos_asset_id` (`asset_id`),
  CONSTRAINT `fk_asset_photos_asset_id_assets` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_photos`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `asset_photos` WRITE;
/*!40000 ALTER TABLE `asset_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_photos` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `inventory_code` varchar(50) NOT NULL,
  `category_id` bigint(20) unsigned NOT NULL,
  `location_id` bigint(20) unsigned DEFAULT NULL,
  `owner_unit_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(150) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `photo_path` varchar(500) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `acquisition_cost` decimal(15,2) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'TERSEDIA',
  `condition` varchar(30) NOT NULL DEFAULT 'BAIK',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  `acquisition_source` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assets_inventory_code` (`inventory_code`),
  KEY `ix_assets_category_id` (`category_id`),
  KEY `ix_assets_condition` (`condition`),
  KEY `ix_assets_is_active` (`is_active`),
  KEY `ix_assets_location_id` (`location_id`),
  KEY `ix_assets_name` (`name`),
  KEY `ix_assets_owner_unit_id` (`owner_unit_id`),
  KEY `ix_assets_serial_number` (`serial_number`),
  KEY `ix_assets_status` (`status`),
  CONSTRAINT `fk_assets_category_id_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `fk_assets_location_id_locations` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_assets_owner_unit_id_organizational_units` FOREIGN KEY (`owner_unit_id`) REFERENCES `organizational_units` (`id`),
  CONSTRAINT `ck_assets_condition` CHECK (`condition` in ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  CONSTRAINT `ck_assets_status` CHECK (`status` in ('TERSEDIA','DIPINJAM','RUSAK','RUSAK_BERAT','DALAM_PERBAIKAN','HILANG','NONAKTIF')),
  CONSTRAINT `ck_assets_acquisition_cost_non_negative` CHECK (`acquisition_cost` is null or `acquisition_cost` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assets`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
INSERT INTO `assets` VALUES
(1,'AST-RPL-001',1,2,2,'ThinkPad T480s','Lenovo','T480s','PF-1A2B3C',NULL,NULL,'2023-06-15',13500000.00,'TERSEDIA','BAIK',1,'2026-10-06 09:35:43.239967','2026-10-06 09:35:43.239967',NULL,NULL),
(2,'AST-RPL-002',1,2,2,'MacBook Pro M1 14-inch','Apple','A2442','C02GXYZ901',NULL,NULL,'2023-08-20',28000000.00,'TERSEDIA','BAIK',1,'2026-10-06 09:35:43.239967','2026-10-06 09:35:43.239967',NULL,NULL),
(3,'AST-SAR-001',2,4,4,'Epson EB-X500 Projector','Epson','EB-X500','EPS-882190',NULL,NULL,'2022-11-05',6500000.00,'TERSEDIA','BAIK',1,'2026-10-06 09:35:43.239967','2026-10-06 09:35:43.239967',NULL,NULL),
(4,'AST-SAR-002',3,4,4,'Sony Alpha A6400 Kit','Sony','ILCE-6400L','SNY-991204',NULL,NULL,'2024-01-10',15000000.00,'TERSEDIA','BAIK',1,'2026-10-06 09:35:43.239967','2026-10-06 09:35:43.239967',NULL,NULL),
(5,'AST-TKJ-001',4,3,3,'Fluke Network Cable Tester Kit','Fluke Networks','MicroScanner2','FLK-440192',NULL,NULL,'2023-03-12',9200000.00,'TERSEDIA','BAIK',1,'2026-10-06 09:35:43.239967','2026-10-06 09:35:43.239967',NULL,NULL),
(6,'AST-TEST-75C5C1',1,1,NULL,'ThinkPad T14 Gen 3 Test','Lenovo','T14 Gen 3','SN-a118eeff',NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:42:47.755094','2026-10-06 10:42:47.755094',NULL,NULL),
(7,'AST-001',1,NULL,NULL,'Duplicate Asset Test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:42:47.787342','2026-10-06 10:42:47.787342',NULL,NULL),
(8,'AST-LOAN-CA1EA2',1,NULL,NULL,'Projector Epson EB-X500',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:42:48.115693','2026-10-06 10:42:48.133874',NULL,NULL),
(9,'AST-LOCK-699DF7',1,NULL,NULL,'Concurrent Concurrency Target Laptop',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:42:48.287321','2026-10-06 10:42:48.287321',NULL,NULL),
(10,'AST-RET-D82417',1,NULL,NULL,'Monitor Dell 24 inch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:42:48.449333','2026-10-06 10:42:48.449333',NULL,NULL),
(11,'AST-DMG-608E92',1,NULL,NULL,'Laptop HP Pavilion',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:42:49.142378','2026-10-06 10:42:49.155147',NULL,NULL),
(12,'AST-TEST-70D665',1,1,NULL,'ThinkPad T14 Gen 3 Test','Lenovo','T14 Gen 3','SN-fab39880',NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:43:47.610773','2026-10-06 10:43:47.610773',NULL,NULL),
(13,'AST-DUP-6BEB3B',1,NULL,NULL,'Original Asset Test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:43:47.636838','2026-10-06 10:43:47.636838',NULL,NULL),
(14,'AST-LOAN-AB2A2C',1,NULL,NULL,'Projector Epson EB-X500',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:43:47.701786','2026-10-06 10:43:47.718635',NULL,NULL),
(15,'AST-LOCK-5D555C',1,NULL,NULL,'Concurrent Concurrency Target Laptop',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:43:47.757320','2026-10-06 10:43:47.786216',NULL,NULL),
(16,'AST-RET-EBAF53',1,NULL,NULL,'Monitor Dell 24 inch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:43:47.879860','2026-10-06 10:43:47.924499',NULL,NULL),
(17,'AST-DMG-BEAF01',1,NULL,NULL,'Laptop HP Pavilion',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'RUSAK','BAIK',1,'2026-10-06 10:43:48.365073','2026-10-06 10:43:48.401388',NULL,NULL),
(18,'AST-TEST-975855',1,1,NULL,'ThinkPad T14 Gen 3 Test','Lenovo','T14 Gen 3','SN-76243040',NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:44:33.917317','2026-10-06 10:44:33.917317',NULL,NULL),
(19,'AST-DUP-2D2572',1,NULL,NULL,'Original Asset Test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:44:33.943405','2026-10-06 10:44:33.943405',NULL,NULL),
(20,'AST-LOAN-14FA93',1,NULL,NULL,'Projector Epson EB-X500',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:44:34.005912','2026-10-06 10:44:34.022734',NULL,NULL),
(21,'AST-LOCK-20D195',1,NULL,NULL,'Concurrent Concurrency Target Laptop',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 10:44:34.061794','2026-10-06 10:44:34.093432',NULL,NULL),
(22,'AST-RET-CCE8BE',1,NULL,NULL,'Monitor Dell 24 inch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:44:34.190500','2026-10-06 10:44:34.228606',NULL,NULL),
(23,'AST-DMG-C38512',1,NULL,NULL,'Laptop HP Pavilion',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 10:44:34.263803','2026-10-06 10:44:34.325069',NULL,NULL),
(24,'AST-TEST-2F3DBC',1,1,NULL,'ThinkPad T14 Gen 3 Test','Lenovo','T14 Gen 3','SN-27ad843b',NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 11:54:49.174400','2026-10-06 11:54:49.174400',NULL,NULL),
(25,'AST-DUP-622DC8',1,NULL,NULL,'Original Asset Test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 11:54:49.200985','2026-10-06 11:54:49.200985',NULL,NULL),
(26,'AST-LOAN-998D68',1,NULL,NULL,'Projector Epson EB-X500',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 11:54:49.268434','2026-10-06 11:54:49.288061',NULL,NULL),
(27,'AST-LOCK-B68DC3',1,NULL,NULL,'Concurrent Concurrency Target Laptop',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DIPINJAM','BAIK',1,'2026-10-06 11:54:49.321921','2026-10-06 11:54:49.351573',NULL,NULL),
(28,'AST-RET-C7B152',1,NULL,NULL,'Monitor Dell 24 inch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 11:54:49.508615','2026-10-06 11:54:49.583235',NULL,NULL),
(29,'AST-DMG-588CF6',1,NULL,NULL,'Laptop HP Pavilion',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TERSEDIA','BAIK',1,'2026-10-06 11:54:49.625540','2026-10-06 11:54:49.675523',NULL,NULL);
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `module` varchar(50) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` bigint(20) unsigned DEFAULT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_audit_logs_action` (`action`),
  KEY `ix_audit_logs_created_at` (`created_at`),
  KEY `ix_audit_logs_entity_type_entity_id` (`entity_type`,`entity_id`),
  KEY `ix_audit_logs_module` (`module`),
  KEY `ix_audit_logs_user_id` (`user_id`),
  CONSTRAINT `fk_audit_logs_user_id_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES
(1,1,'LOGIN_SUCCESS','auth','user',1,'null','null',NULL,NULL,'2026-10-06 10:41:02.796815'),
(2,1,'LOGIN_SUCCESS','auth','user',1,'null','null',NULL,NULL,'2026-10-06 10:42:47.711444'),
(3,1,'CREATE','asset','asset',6,'null','{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-75C5C1\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-a118eeff\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:42:47.760741'),
(4,1,'CREATE','asset','asset',7,'null','{\"category_id\": 1, \"inventory_code\": \"AST-001\", \"name\": \"Duplicate Asset Test\"}','127.0.0.1',NULL,'2026-10-06 10:42:47.789330'),
(5,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:42:48.070644'),
(6,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:42:48.091240'),
(7,1,'CREATE','asset','asset',8,'null','{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-CA1EA2\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:42:48.117789'),
(8,1,'CHECKOUT_CREATED','borrowing','borrowing',1,'null','{\"transaction_number\": \"TX-20261006104248\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [8], \"due_date\": \"2026-10-13\"}','127.0.0.1',NULL,'2026-10-06 10:42:48.134669'),
(9,1,'CREATE','borrower','borrower',4,'null','{\"email\": \"peminjam_3d850e@example.com\", \"identity_number\": \"ID-3d850e\", \"name\": \"Peminjam Test 3d850e\", \"phone\": \"08123456789\", \"position\": \"Guru Produktif\", \"unit_id\": 1}','127.0.0.1',NULL,'2026-10-06 10:42:48.393761'),
(10,1,'UPDATE','borrower','borrower',4,'{\"name\": \"Peminjam Test 3d850e\", \"email\": \"peminjam_3d850e@example.com\", \"phone\": \"08123456789\", \"is_active\": true}','{\"position\": \"Kepala Lab\"}','127.0.0.1',NULL,'2026-10-06 10:42:48.400863'),
(11,1,'DELETE','borrower','borrower',4,'null','null','127.0.0.1',NULL,'2026-10-06 10:42:48.408524'),
(12,1,'CREATE','asset','asset',10,'null','{\"category_id\": 1, \"inventory_code\": \"AST-RET-D82417\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:42:48.451559'),
(13,1,'CREATE','asset','asset',11,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DMG-608E92\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:42:49.144655'),
(14,1,'CHECKOUT_CREATED','borrowing','borrowing',5,'null','{\"transaction_number\": \"TX-20261006104249\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [11], \"due_date\": \"2026-10-08\"}','127.0.0.1',NULL,'2026-10-06 10:42:49.156229'),
(15,1,'LOGIN_SUCCESS','auth','user',1,'null','null',NULL,NULL,'2026-10-06 10:43:47.577175'),
(16,1,'CREATE','asset','asset',12,'null','{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-70D665\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-fab39880\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.613340'),
(17,1,'CREATE','asset','asset',13,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DUP-6BEB3B\", \"name\": \"Original Asset Test\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.640004'),
(18,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:43:47.661276'),
(19,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:43:47.682319'),
(20,1,'CREATE','asset','asset',14,'null','{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-AB2A2C\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.703716'),
(21,1,'CHECKOUT_CREATED','borrowing','borrowing',6,'null','{\"transaction_number\": \"TX-20261006104347-A056\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [14], \"due_date\": \"2026-10-13\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.719420'),
(22,1,'CHECKOUT_CREATED','borrowing','borrowing',8,'null','{\"transaction_number\": \"TX-20261006104347-D5B6\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [15], \"due_date\": \"2026-10-11\"}',NULL,NULL,'2026-10-06 10:43:47.789842'),
(23,1,'CREATE','borrower','borrower',5,'null','{\"email\": \"peminjam_5758e2@example.com\", \"identity_number\": \"ID-5758e2\", \"name\": \"Peminjam Test 5758e2\", \"phone\": \"08123456789\", \"position\": \"Guru Produktif\", \"unit_id\": 1}','127.0.0.1',NULL,'2026-10-06 10:43:47.836939'),
(24,1,'UPDATE','borrower','borrower',5,'{\"name\": \"Peminjam Test 5758e2\", \"email\": \"peminjam_5758e2@example.com\", \"phone\": \"08123456789\", \"is_active\": true}','{\"position\": \"Kepala Lab\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.843153'),
(25,1,'DELETE','borrower','borrower',5,'null','null','127.0.0.1',NULL,'2026-10-06 10:43:47.849301'),
(26,1,'CREATE','asset','asset',16,'null','{\"category_id\": 1, \"inventory_code\": \"AST-RET-EBAF53\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.882010'),
(27,1,'CHECKOUT_CREATED','borrowing','borrowing',10,'null','{\"transaction_number\": \"TX-20261006104347-5380\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [16], \"due_date\": \"2026-10-09\"}','127.0.0.1',NULL,'2026-10-06 10:43:47.894553'),
(28,1,'RETURN_PROCESSED','return','return',1,'null','{\"borrowing_id\": 10, \"transaction_number\": \"TX-20261006104347-5380\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 10:43:47.925333'),
(29,1,'CREATE','asset','asset',17,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DMG-BEAF01\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:43:48.366818'),
(30,1,'CHECKOUT_CREATED','borrowing','borrowing',11,'null','{\"transaction_number\": \"TX-20261006104348-4B52\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [17], \"due_date\": \"2026-10-08\"}','127.0.0.1',NULL,'2026-10-06 10:43:48.378551'),
(31,1,'RETURN_PROCESSED','return','return',2,'null','{\"borrowing_id\": 11, \"transaction_number\": \"TX-20261006104348-4B52\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 10:43:48.402064'),
(32,1,'LOGIN_SUCCESS','auth','user',1,'null','null',NULL,NULL,'2026-10-06 10:44:33.881926'),
(33,1,'CREATE','asset','asset',18,'null','{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-975855\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-76243040\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:44:33.920260'),
(34,1,'CREATE','asset','asset',19,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DUP-2D2572\", \"name\": \"Original Asset Test\"}','127.0.0.1',NULL,'2026-10-06 10:44:33.945504'),
(35,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:44:33.964861'),
(36,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 10:44:33.986444'),
(37,1,'CREATE','asset','asset',20,'null','{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-14FA93\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.008051'),
(38,1,'CHECKOUT_CREATED','borrowing','borrowing',12,'null','{\"transaction_number\": \"TX-20261006104434-7336\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [20], \"due_date\": \"2026-10-13\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.023547'),
(39,1,'CHECKOUT_CREATED','borrowing','borrowing',14,'null','{\"transaction_number\": \"TX-20261006104434-8D1B\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [21], \"due_date\": \"2026-10-11\"}',NULL,NULL,'2026-10-06 10:44:34.094241'),
(40,1,'CREATE','borrower','borrower',6,'null','{\"email\": \"peminjam_877fcb@example.com\", \"identity_number\": \"ID-877fcb\", \"name\": \"Peminjam Test 877fcb\", \"phone\": \"08123456789\", \"position\": \"Guru Produktif\", \"unit_id\": 1}','127.0.0.1',NULL,'2026-10-06 10:44:34.140474'),
(41,1,'UPDATE','borrower','borrower',6,'{\"name\": \"Peminjam Test 877fcb\", \"email\": \"peminjam_877fcb@example.com\", \"phone\": \"08123456789\", \"is_active\": true}','{\"position\": \"Kepala Lab\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.145580'),
(42,1,'DELETE','borrower','borrower',6,'null','null','127.0.0.1',NULL,'2026-10-06 10:44:34.153343'),
(43,1,'CREATE','asset','asset',22,'null','{\"category_id\": 1, \"inventory_code\": \"AST-RET-CCE8BE\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.192671'),
(44,1,'CHECKOUT_CREATED','borrowing','borrowing',16,'null','{\"transaction_number\": \"TX-20261006104434-9443\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [22], \"due_date\": \"2026-10-09\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.204659'),
(45,1,'RETURN_PROCESSED','return','return',3,'null','{\"borrowing_id\": 16, \"transaction_number\": \"TX-20261006104434-9443\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 10:44:34.229268'),
(46,1,'CREATE','asset','asset',23,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DMG-C38512\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.266656'),
(47,1,'CHECKOUT_CREATED','borrowing','borrowing',17,'null','{\"transaction_number\": \"TX-20261006104434-4D6B\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [23], \"due_date\": \"2026-10-08\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.277248'),
(48,1,'RETURN_PROCESSED','return','return',4,'null','{\"borrowing_id\": 17, \"transaction_number\": \"TX-20261006104434-4D6B\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 10:44:34.298237'),
(49,1,'DAMAGE_STATUS_UPDATED','damage','damage_report',2,'{\"repair_status\": \"DILAPORKAN\"}','{\"repair_status\": \"SELESAI\", \"repair_cost\": \"250000.00\"}','127.0.0.1',NULL,'2026-10-06 10:44:34.325881'),
(50,1,'LOGIN_SUCCESS','auth','user',1,'null','null',NULL,NULL,'2026-10-06 11:54:49.130574'),
(51,1,'CREATE','asset','asset',24,'null','{\"brand\": \"Lenovo\", \"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-TEST-2F3DBC\", \"location_id\": 1, \"model\": \"T14 Gen 3\", \"name\": \"ThinkPad T14 Gen 3 Test\", \"serial_number\": \"SN-27ad843b\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.179740'),
(52,1,'CREATE','asset','asset',25,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DUP-622DC8\", \"name\": \"Original Asset Test\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.202744'),
(53,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 11:54:49.223492'),
(54,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-06 11:54:49.245403'),
(55,1,'CREATE','asset','asset',26,'null','{\"category_id\": 1, \"condition\": \"BAIK\", \"inventory_code\": \"AST-LOAN-998D68\", \"name\": \"Projector Epson EB-X500\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.271302'),
(56,1,'CHECKOUT_CREATED','borrowing','borrowing',18,'null','{\"transaction_number\": \"TX-20261006115449-FD03\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [26], \"due_date\": \"2026-10-13\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.288885'),
(57,1,'CHECKOUT_CREATED','borrowing','borrowing',20,'null','{\"transaction_number\": \"TX-20261006115449-6AB9\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [27], \"due_date\": \"2026-10-11\"}',NULL,NULL,'2026-10-06 11:54:49.352756'),
(58,1,'CREATE','borrower','borrower',7,'null','{\"email\": \"peminjam_fee0ec@example.com\", \"identity_number\": \"ID-fee0ec\", \"name\": \"Peminjam Test fee0ec\", \"phone\": \"08123456789\", \"position\": \"Guru Produktif\", \"unit_id\": 1}','127.0.0.1',NULL,'2026-10-06 11:54:49.424805'),
(59,1,'UPDATE','borrower','borrower',7,'{\"name\": \"Peminjam Test fee0ec\", \"email\": \"peminjam_fee0ec@example.com\", \"phone\": \"08123456789\", \"is_active\": true}','{\"position\": \"Kepala Lab\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.432699'),
(60,1,'DELETE','borrower','borrower',7,'null','null','127.0.0.1',NULL,'2026-10-06 11:54:49.441653'),
(61,1,'CREATE','asset','asset',28,'null','{\"category_id\": 1, \"inventory_code\": \"AST-RET-C7B152\", \"name\": \"Monitor Dell 24 inch\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.512675'),
(62,1,'CHECKOUT_CREATED','borrowing','borrowing',22,'null','{\"transaction_number\": \"TX-20261006115449-C74D\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [28], \"due_date\": \"2026-10-09\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.529149'),
(63,1,'RETURN_PROCESSED','return','return',5,'null','{\"borrowing_id\": 22, \"transaction_number\": \"TX-20261006115449-C74D\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 11:54:49.584747'),
(64,1,'CREATE','asset','asset',29,'null','{\"category_id\": 1, \"inventory_code\": \"AST-DMG-588CF6\", \"name\": \"Laptop HP Pavilion\", \"status\": \"TERSEDIA\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.628188'),
(65,1,'CHECKOUT_CREATED','borrowing','borrowing',23,'null','{\"transaction_number\": \"TX-20261006115449-FA56\", \"borrower_id\": 1, \"borrower_name\": \"Ahmad Pratama\", \"asset_ids\": [29], \"due_date\": \"2026-10-08\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.636154'),
(66,1,'RETURN_PROCESSED','return','return',6,'null','{\"borrowing_id\": 23, \"transaction_number\": \"TX-20261006115449-FA56\", \"items_returned_count\": 1, \"borrowing_completed\": true}','127.0.0.1',NULL,'2026-10-06 11:54:49.656007'),
(67,1,'DAMAGE_STATUS_UPDATED','damage','damage_report',3,'{\"repair_status\": \"DILAPORKAN\"}','{\"repair_status\": \"SELESAI\", \"repair_cost\": \"250000.00\"}','127.0.0.1',NULL,'2026-10-06 11:54:49.676523'),
(68,NULL,'LOGIN_FAILED','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 10:56:56.473054'),
(69,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 10:57:06.317565'),
(70,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 10:57:12.404509'),
(71,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 10:57:18.474979'),
(72,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 10:57:24.459209'),
(73,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 11:36:38.623502'),
(74,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 14:09:29.566064'),
(75,1,'LOGOUT','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-07 14:17:33.386776'),
(76,NULL,'LOGIN_FAILED','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-08 09:13:23.508411'),
(77,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-08 09:14:29.921863'),
(78,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-08 09:14:44.762324'),
(79,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-19 07:50:04.413999'),
(80,1,'LOGIN_SUCCESS','auth','user',1,'null','null','127.0.0.1',NULL,'2026-10-19 09:18:47.118479');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `borrowers`
--

DROP TABLE IF EXISTS `borrowers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrowers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `unit_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `identity_number` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `position` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_borrowers_email` (`email`),
  KEY `ix_borrowers_identity_number` (`identity_number`),
  KEY `ix_borrowers_is_active` (`is_active`),
  KEY `ix_borrowers_name` (`name`),
  KEY `ix_borrowers_unit_id` (`unit_id`),
  CONSTRAINT `fk_borrowers_unit_id_organizational_units` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrowers`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `borrowers` WRITE;
/*!40000 ALTER TABLE `borrowers` DISABLE KEYS */;
INSERT INTO `borrowers` VALUES
(1,2,'Ahmad Pratama','NISN-0051234567','ahmad.pratama@siswa.sch.id','081234567801','Siswa XII RPL 1',1,'2026-10-06 09:35:43.243021','2026-10-06 09:35:43.243021',NULL),
(2,3,'Siti Rahmawati','NISN-0057654321','siti.rahma@siswa.sch.id','081234567802','Siswa XII TKJ 2',1,'2026-10-06 09:35:43.243021','2026-10-06 09:35:43.243021',NULL),
(3,2,'Dedi Kurniawan, S.Kom','NIP-198501012010011005','dedi.kurniawan@guru.sch.id','081234567803','Guru Produktif RPL',1,'2026-10-06 09:35:43.243021','2026-10-06 09:35:43.243021',NULL),
(4,1,'Peminjam Test 3d850e','ID-3d850e','peminjam_3d850e@example.com','08123456789','Kepala Lab',0,'2026-10-06 10:42:48.391722','2026-10-06 10:42:48.409502','2026-10-06 10:42:48.407656'),
(5,1,'Peminjam Test 5758e2','ID-5758e2','peminjam_5758e2@example.com','08123456789','Kepala Lab',0,'2026-10-06 10:43:47.835673','2026-10-06 10:43:47.850289','2026-10-06 10:43:47.848278'),
(6,1,'Peminjam Test 877fcb','ID-877fcb','peminjam_877fcb@example.com','08123456789','Kepala Lab',0,'2026-10-06 10:44:34.139233','2026-10-06 10:44:34.154340','2026-10-06 10:44:34.152351'),
(7,1,'Peminjam Test fee0ec','ID-fee0ec','peminjam_fee0ec@example.com','08123456789','Kepala Lab',0,'2026-10-06 11:54:49.422530','2026-10-06 11:54:49.444556','2026-10-06 11:54:49.439568');
/*!40000 ALTER TABLE `borrowers` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `borrowing_items`
--

DROP TABLE IF EXISTS `borrowing_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrowing_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `borrowing_id` bigint(20) unsigned NOT NULL,
  `asset_id` bigint(20) unsigned NOT NULL,
  `checked_out_at` datetime(6) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `condition_out` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_borrowing_items_borrowing_id_asset_id` (`borrowing_id`,`asset_id`),
  KEY `ix_borrowing_items_asset_id` (`asset_id`),
  CONSTRAINT `fk_borrowing_items_asset_id_assets` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_borrowing_items_borrowing_id_borrowings` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrowing_items`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `borrowing_items` WRITE;
/*!40000 ALTER TABLE `borrowing_items` DISABLE KEYS */;
INSERT INTO `borrowing_items` VALUES
(1,1,8,'2026-10-06 10:42:48.124889',NULL,'2026-10-06 10:42:48.140858','BAIK'),
(2,5,11,'2026-10-06 10:42:49.151318',NULL,'2026-10-06 10:42:49.159484','BAIK'),
(3,6,14,'2026-10-06 10:43:47.712597',NULL,'2026-10-06 10:43:47.724970','BAIK'),
(4,8,15,'2026-10-06 10:43:47.763228',NULL,'2026-10-06 10:43:47.793396','BAIK'),
(5,10,16,'2026-10-06 10:43:47.887683',NULL,'2026-10-06 10:43:47.896729','BAIK'),
(6,11,17,'2026-10-06 10:43:48.374201',NULL,'2026-10-06 10:43:48.380591','BAIK'),
(7,12,20,'2026-10-06 10:44:34.015128',NULL,'2026-10-06 10:44:34.027079','BAIK'),
(8,14,21,'2026-10-06 10:44:34.081762',NULL,'2026-10-06 10:44:34.096878','BAIK'),
(9,16,22,'2026-10-06 10:44:34.198277',NULL,'2026-10-06 10:44:34.206587','BAIK'),
(10,17,23,'2026-10-06 10:44:34.272451',NULL,'2026-10-06 10:44:34.279019','BAIK'),
(11,18,26,'2026-10-06 11:54:49.281002',NULL,'2026-10-06 11:54:49.294016','BAIK'),
(12,20,27,'2026-10-06 11:54:49.329055',NULL,'2026-10-06 11:54:49.356875','BAIK'),
(13,22,28,'2026-10-06 11:54:49.521345',NULL,'2026-10-06 11:54:49.532572','BAIK'),
(14,23,29,'2026-10-06 11:54:49.632603',NULL,'2026-10-06 11:54:49.637588','BAIK');
/*!40000 ALTER TABLE `borrowing_items` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `borrowings`
--

DROP TABLE IF EXISTS `borrowings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrowings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transaction_number` varchar(50) NOT NULL,
  `borrower_id` bigint(20) unsigned NOT NULL,
  `handled_by` bigint(20) unsigned NOT NULL,
  `borrowed_at` datetime(6) NOT NULL,
  `start_date` date NOT NULL,
  `due_date` date NOT NULL,
  `purpose` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'AKTIF',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `checked_out_at` datetime(6) DEFAULT NULL,
  `checked_out_by` bigint(20) unsigned DEFAULT NULL,
  `cancelled_at` datetime(6) DEFAULT NULL,
  `cancel_reason` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_borrowings_transaction_number` (`transaction_number`),
  KEY `ix_borrowings_borrowed_at` (`borrowed_at`),
  KEY `ix_borrowings_borrower_id` (`borrower_id`),
  KEY `ix_borrowings_due_date` (`due_date`),
  KEY `ix_borrowings_handled_by` (`handled_by`),
  KEY `ix_borrowings_status_due_date` (`status`,`due_date`),
  KEY `ix_borrowings_checked_out_by` (`checked_out_by`),
  CONSTRAINT `fk_borrowings_borrower_id_borrowers` FOREIGN KEY (`borrower_id`) REFERENCES `borrowers` (`id`),
  CONSTRAINT `fk_borrowings_checked_out_by_users` FOREIGN KEY (`checked_out_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_borrowings_handled_by_users` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_borrowings_due_date_after_start` CHECK (`due_date` >= `start_date`),
  CONSTRAINT `ck_borrowings_status` CHECK (`status` in ('DRAF','AKTIF','TERLAMBAT','DIKEMBALIKAN','DIBATALKAN'))
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrowings`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `borrowings` WRITE;
/*!40000 ALTER TABLE `borrowings` DISABLE KEYS */;
INSERT INTO `borrowings` VALUES
(1,'TX-20261006104248',1,1,'2026-10-06 10:42:48.124889','2026-10-06','2026-10-13','Presentasi Kurikulum',NULL,'AKTIF','2026-10-06 10:42:48.127224','2026-10-07 10:56:50.979553','2026-10-06 10:42:48.124889',1,NULL,NULL),
(5,'TX-20261006104249',1,1,'2026-10-06 10:42:49.151318','2026-10-06','2026-10-08',NULL,NULL,'AKTIF','2026-10-06 10:42:49.152481','2026-10-07 10:56:50.979553','2026-10-06 10:42:49.151318',1,NULL,NULL),
(6,'TX-20261006104347-A056',1,1,'2026-10-06 10:43:47.712597','2026-10-06','2026-10-13','Presentasi Kurikulum',NULL,'AKTIF','2026-10-06 10:43:47.714176','2026-10-07 10:56:50.979553','2026-10-06 10:43:47.712597',1,NULL,NULL),
(8,'TX-20261006104347-D5B6',1,1,'2026-10-06 10:43:47.763228','2026-10-06','2026-10-11','Test concurrent checkout from thread 1',NULL,'AKTIF','2026-10-06 10:43:47.764210','2026-10-07 10:56:50.979553','2026-10-06 10:43:47.763228',1,NULL,NULL),
(10,'TX-20261006104347-5380',1,1,'2026-10-06 10:43:47.887683','2026-10-06','2026-10-09',NULL,NULL,'DIKEMBALIKAN','2026-10-06 10:43:47.889975','2026-10-07 10:56:50.979553','2026-10-06 10:43:47.887683',1,NULL,NULL),
(11,'TX-20261006104348-4B52',1,1,'2026-10-06 10:43:48.374201','2026-10-06','2026-10-08',NULL,NULL,'DIKEMBALIKAN','2026-10-06 10:43:48.375132','2026-10-07 10:56:50.979553','2026-10-06 10:43:48.374201',1,NULL,NULL),
(12,'TX-20261006104434-7336',1,1,'2026-10-06 10:44:34.015128','2026-10-06','2026-10-13','Presentasi Kurikulum',NULL,'AKTIF','2026-10-06 10:44:34.018027','2026-10-07 10:56:50.979553','2026-10-06 10:44:34.015128',1,NULL,NULL),
(14,'TX-20261006104434-8D1B',1,1,'2026-10-06 10:44:34.081762','2026-10-06','2026-10-11','Test concurrent checkout from thread 1',NULL,'AKTIF','2026-10-06 10:44:34.083199','2026-10-07 10:56:50.979553','2026-10-06 10:44:34.081762',1,NULL,NULL),
(16,'TX-20261006104434-9443',1,1,'2026-10-06 10:44:34.198277','2026-10-06','2026-10-09',NULL,NULL,'DIKEMBALIKAN','2026-10-06 10:44:34.200053','2026-10-07 10:56:50.979553','2026-10-06 10:44:34.198277',1,NULL,NULL),
(17,'TX-20261006104434-4D6B',1,1,'2026-10-06 10:44:34.272451','2026-10-06','2026-10-08',NULL,NULL,'DIKEMBALIKAN','2026-10-06 10:44:34.273830','2026-10-07 10:56:50.979553','2026-10-06 10:44:34.272451',1,NULL,NULL),
(18,'TX-20261006115449-FD03',1,1,'2026-10-06 11:54:49.281002','2026-10-06','2026-10-13','Presentasi Kurikulum',NULL,'AKTIF','2026-10-06 11:54:49.282552','2026-10-07 10:56:50.979553','2026-10-06 11:54:49.281002',1,NULL,NULL),
(20,'TX-20261006115449-6AB9',1,1,'2026-10-06 11:54:49.329055','2026-10-06','2026-10-11','Test concurrent checkout from thread 1',NULL,'AKTIF','2026-10-06 11:54:49.330312','2026-10-07 10:56:50.979553','2026-10-06 11:54:49.329055',1,NULL,NULL),
(22,'TX-20261006115449-C74D',1,1,'2026-10-06 11:54:49.521345','2026-10-06','2026-10-09',NULL,NULL,'DIKEMBALIKAN','2026-10-06 11:54:49.522360','2026-10-07 10:56:50.979553','2026-10-06 11:54:49.521345',1,NULL,NULL),
(23,'TX-20261006115449-FA56',1,1,'2026-10-06 11:54:49.632603','2026-10-06','2026-10-08',NULL,NULL,'DIKEMBALIKAN','2026-10-06 11:54:49.633638','2026-10-07 10:56:50.979553','2026-10-06 11:54:49.632603',1,NULL,NULL);
/*!40000 ALTER TABLE `borrowings` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_code` (`code`),
  KEY `ix_categories_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES
(1,'CAT-LAPTOP','Laptop & Komputer',NULL,1,'2026-10-06 09:35:43.226553','2026-10-06 09:35:43.226553',NULL),
(2,'CAT-PROYEKTOR','Proyektor & Layar',NULL,1,'2026-10-06 09:35:43.226553','2026-10-06 09:35:43.226553',NULL),
(3,'CAT-KAMERA','Kamera & Multimedia',NULL,1,'2026-10-06 09:35:43.226553','2026-10-06 09:35:43.226553',NULL),
(4,'CAT-TOOLSET','Perkakas & Jaringan',NULL,1,'2026-10-06 09:35:43.226553','2026-10-06 09:35:43.226553',NULL);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_locations_code` (`code`),
  KEY `ix_locations_is_active` (`is_active`),
  KEY `ix_locations_parent_id` (`parent_id`),
  CONSTRAINT `fk_locations_parent_id_locations` FOREIGN KEY (`parent_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` VALUES
(1,NULL,'LOC-GEDUNG-A','Gedung Utama (A)',NULL,1,'2026-10-06 09:35:43.229956','2026-10-06 09:35:43.229956',NULL),
(2,1,'LOC-LAB-RPL','Laboratorium Software RPL',NULL,1,'2026-10-06 09:35:43.236438','2026-10-06 09:35:43.236438',NULL),
(3,1,'LOC-LAB-TKJ','Laboratorium Jaringan TKJ',NULL,1,'2026-10-06 09:35:43.236438','2026-10-06 09:35:43.236438',NULL),
(4,1,'LOC-GUDANG','Gudang Inventaris Sarpras',NULL,1,'2026-10-06 09:35:43.236438','2026-10-06 09:35:43.236438',NULL);
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_deliveries`
--

DROP TABLE IF EXISTS `notification_deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_deliveries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `notification_id` bigint(20) unsigned NOT NULL,
  `attempt_number` int(10) unsigned NOT NULL,
  `channel` varchar(20) NOT NULL DEFAULT 'EMAIL',
  `provider` varchar(50) DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `status` varchar(30) NOT NULL,
  `error_message` text DEFAULT NULL,
  `attempted_at` datetime(6) NOT NULL,
  `delivered_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_deliveries_notification_id_attempt_number` (`notification_id`,`attempt_number`),
  KEY `ix_notification_deliveries_attempted_at` (`attempted_at`),
  KEY `ix_notification_deliveries_notification_id` (`notification_id`),
  KEY `ix_notification_deliveries_status` (`status`),
  CONSTRAINT `fk_notification_deliveries_notification_id_notifications` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_notification_deliveries_ck_notification_deliveries_at_4495` CHECK (`attempt_number` >= 1),
  CONSTRAINT `ck_notification_deliveries_ck_notification_deliveries_status` CHECK (`status` in ('PENDING','SENT','FAILED','RETRYING'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_deliveries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notification_deliveries` WRITE;
/*!40000 ALTER TABLE `notification_deliveries` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_deliveries` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_events`
--

DROP TABLE IF EXISTS `notification_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `borrowing_id` bigint(20) unsigned NOT NULL,
  `event_code` varchar(50) NOT NULL,
  `scheduled_at` datetime(6) NOT NULL,
  `processed_at` datetime(6) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'PENDING',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_events_borrowing_id_event_code` (`borrowing_id`,`event_code`),
  KEY `ix_notification_events_status_scheduled_at` (`status`,`scheduled_at`),
  CONSTRAINT `fk_notification_events_borrowing_id_borrowings` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings` (`id`),
  CONSTRAINT `ck_notification_events_status` CHECK (`status` in ('PENDING','PROCESSING','PROCESSED','SKIPPED','FAILED'))
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_events`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notification_events` WRITE;
/*!40000 ALTER TABLE `notification_events` DISABLE KEYS */;
INSERT INTO `notification_events` VALUES
(1,1,'LOAN_CONFIRMATION','2026-10-06 10:42:48.124889',NULL,'PENDING','2026-10-06 10:42:48.136026'),
(2,5,'LOAN_CONFIRMATION','2026-10-06 10:42:49.151318',NULL,'PENDING','2026-10-06 10:42:49.157537'),
(3,6,'LOAN_CONFIRMATION','2026-10-06 10:43:47.712597',NULL,'PENDING','2026-10-06 10:43:47.720769'),
(4,8,'LOAN_CONFIRMATION','2026-10-06 10:43:47.763228',NULL,'PENDING','2026-10-06 10:43:47.791278'),
(5,10,'LOAN_CONFIRMATION','2026-10-06 10:43:47.887683',NULL,'PENDING','2026-10-06 10:43:47.895361'),
(6,10,'RETURN_CONFIRMATION','2026-10-06 10:43:47.908683',NULL,'PENDING','2026-10-06 10:43:47.927960'),
(7,11,'LOAN_CONFIRMATION','2026-10-06 10:43:48.374201',NULL,'PENDING','2026-10-06 10:43:48.379252'),
(8,11,'RETURN_CONFIRMATION','2026-10-06 10:43:48.392210',NULL,'PENDING','2026-10-06 10:43:48.407521'),
(9,12,'LOAN_CONFIRMATION','2026-10-06 10:44:34.015128',NULL,'PENDING','2026-10-06 10:44:34.024836'),
(10,14,'LOAN_CONFIRMATION','2026-10-06 10:44:34.081762',NULL,'PENDING','2026-10-06 10:44:34.095060'),
(11,16,'LOAN_CONFIRMATION','2026-10-06 10:44:34.198277',NULL,'PENDING','2026-10-06 10:44:34.205336'),
(12,16,'RETURN_CONFIRMATION','2026-10-06 10:44:34.217232',NULL,'PENDING','2026-10-06 10:44:34.231777'),
(13,17,'LOAN_CONFIRMATION','2026-10-06 10:44:34.272451',NULL,'PENDING','2026-10-06 10:44:34.277889'),
(14,17,'RETURN_CONFIRMATION','2026-10-06 10:44:34.289447',NULL,'PENDING','2026-10-06 10:44:34.302993'),
(15,18,'LOAN_CONFIRMATION','2026-10-06 11:54:49.281002',NULL,'PENDING','2026-10-06 11:54:49.290291'),
(16,20,'LOAN_CONFIRMATION','2026-10-06 11:54:49.329055',NULL,'PENDING','2026-10-06 11:54:49.354467'),
(17,22,'LOAN_CONFIRMATION','2026-10-06 11:54:49.521345',NULL,'PENDING','2026-10-06 11:54:49.530256'),
(18,22,'RETURN_CONFIRMATION','2026-10-06 11:54:49.547728',NULL,'PENDING','2026-10-06 11:54:49.590209'),
(19,23,'LOAN_CONFIRMATION','2026-10-06 11:54:49.632603',NULL,'PENDING','2026-10-06 11:54:49.636653'),
(20,23,'RETURN_CONFIRMATION','2026-10-06 11:54:49.648145',NULL,'PENDING','2026-10-06 11:54:49.659796');
/*!40000 ALTER TABLE `notification_events` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_reads`
--

DROP TABLE IF EXISTS `notification_reads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_reads` (
  `notification_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `read_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`notification_id`,`user_id`),
  KEY `ix_notification_reads_user_id` (`user_id`),
  CONSTRAINT `fk_notification_reads_notification_id_notifications` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_reads_user_id_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_reads`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notification_reads` WRITE;
/*!40000 ALTER TABLE `notification_reads` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_reads` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_templates_code` (`code`),
  KEY `ix_notification_templates_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
INSERT INTO `notification_templates` VALUES
(1,'LOAN_CONFIRMATION','Konfirmasi peminjaman','[SIIPB] Peminjaman {{kode_transaksi}} — kembalikan paling lambat {{batas_kembali}}','Yth. {{nama_peminjam}},\n\nPetugas Sarpras/IT telah mencatat peminjaman barang atas nama Anda:\n\n{{daftar_barang}}\n\nTanggal peminjaman : {{tanggal_pinjam}}\nBatas pengembalian : {{batas_kembali}}\nTujuan             : {{tujuan}}\n\nMohon kembalikan barang sebelum batas waktu. Kondisi dan kelengkapan barang akan diperiksa saat pengembalian.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-06 09:35:43.247676','2026-10-07 10:56:50.973677'),
(2,'H_MINUS_1','Pengingat H-1','[SIIPB] Besok batas pengembalian {{kode_transaksi}}','Yth. {{nama_peminjam}},\n\nBesok, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n{{daftar_barang}}\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-06 09:35:43.247676','2026-10-07 10:56:50.975665'),
(3,'RETURN_CONFIRMATION','Konfirmasi pengembalian','[SIIPB] Pengembalian {{kode_transaksi}} telah diterima','Yth. {{nama_peminjam}},\n\nPetugas telah menerima pengembalian barang berikut pada {{tanggal_kembali}}:\n\n{{daftar_barang_kembali}}\n\nTerima kasih.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-06 09:35:43.247676','2026-10-07 10:56:50.979235'),
(4,'H_MINUS_3','Pengingat H-3','[SIIPB] Pengingat: batas pengembalian {{kode_transaksi}} tinggal 3 hari','Yth. {{nama_peminjam}},\n\nBarang berikut harus dikembalikan paling lambat {{batas_kembali}} (3 hari lagi):\n\n{{daftar_barang}}\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-07 10:56:50.974912','2026-10-07 10:56:50.974912'),
(5,'H_DAY','Hari ini jatuh tempo','[SIIPB] Hari ini batas pengembalian {{kode_transaksi}}','Yth. {{nama_peminjam}},\n\nHari ini, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n{{daftar_barang}}\n\nMohon diserahkan ke petugas hari ini.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-07 10:56:50.976382','2026-10-07 10:56:50.976382'),
(6,'H_PLUS_1','Terlambat H+1','[SIIPB] Peminjaman {{kode_transaksi}} terlambat {{hari_terlambat}} hari','Yth. {{nama_peminjam}},\n\nBatas pengembalian barang berikut telah lewat ({{batas_kembali}}). Saat ini terlambat {{hari_terlambat}} hari:\n\n{{daftar_barang}}\n\nMohon segera mengembalikan barang.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-07 10:56:50.977065','2026-10-07 10:56:50.977065'),
(7,'H_PLUS_3','Eskalasi H+3','[SIIPB] ESKALASI: {{kode_transaksi}} terlambat {{hari_terlambat}} hari','Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT)\n\nPeminjaman {{kode_transaksi}} telah terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nPetugas akan menindaklanjuti keterlambatan ini.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-07 10:56:50.977903','2026-10-07 10:56:50.977903'),
(8,'H_PLUS_7','Eskalasi lanjutan H+7','[SIIPB] ESKALASI LANJUTAN: {{kode_transaksi}} terlambat {{hari_terlambat}} hari','Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT dan Pimpinan)\n\nPeminjaman {{kode_transaksi}} telah terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nKeterlambatan ini telah dilaporkan kepada pimpinan unit.\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.',1,'2026-10-07 10:56:50.978590','2026-10-07 10:56:50.978590');
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `borrower_id` bigint(20) unsigned NOT NULL,
  `template_id` bigint(20) unsigned NOT NULL,
  `channel` varchar(20) NOT NULL DEFAULT 'EMAIL',
  `recipient` varchar(255) NOT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body_snapshot` text DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'QUEUED',
  `sent_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `recipient_name` varchar(150) DEFAULT NULL,
  `recipient_type` varchar(20) NOT NULL DEFAULT 'PEMINJAM',
  `recipient_user_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_notifications_borrower_id` (`borrower_id`),
  KEY `ix_notifications_event_id` (`event_id`),
  KEY `ix_notifications_status` (`status`),
  KEY `ix_notifications_template_id` (`template_id`),
  KEY `ix_notifications_recipient_user_id` (`recipient_user_id`),
  CONSTRAINT `fk_notifications_borrower_id_borrowers` FOREIGN KEY (`borrower_id`) REFERENCES `borrowers` (`id`),
  CONSTRAINT `fk_notifications_event_id_notification_events` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`),
  CONSTRAINT `fk_notifications_recipient_user_id_users` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notifications_template_id_notification_templates` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`),
  CONSTRAINT `ck_notifications_channel` CHECK (`channel` = 'EMAIL'),
  CONSTRAINT `ck_notifications_status` CHECK (`status` in ('QUEUED','PROCESSING','SENT','FAILED','RETRYING')),
  CONSTRAINT `ck_notifications_recipient_type` CHECK (`recipient_type` in ('PEMINJAM','PETUGAS','PIMPINAN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `organizational_units`
--

DROP TABLE IF EXISTS `organizational_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizational_units` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organizational_units_code` (`code`),
  KEY `ix_organizational_units_is_active` (`is_active`),
  KEY `ix_organizational_units_parent_id` (`parent_id`),
  CONSTRAINT `fk_organizational_units_parent_id_organizational_units` FOREIGN KEY (`parent_id`) REFERENCES `organizational_units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizational_units`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `organizational_units` WRITE;
/*!40000 ALTER TABLE `organizational_units` DISABLE KEYS */;
INSERT INTO `organizational_units` VALUES
(1,NULL,'SMKN1','SMK Negeri 1',NULL,1,'2026-10-06 09:35:43.206880','2026-10-06 09:35:43.206880'),
(2,1,'RPL','Jurusan RPL',NULL,1,'2026-10-06 09:35:43.209686','2026-10-06 09:35:43.209686'),
(3,1,'TKJ','Jurusan TKJ',NULL,1,'2026-10-06 09:35:43.209686','2026-10-06 09:35:43.209686'),
(4,1,'SARPRAS','Unit Sarana & Prasarana',NULL,1,'2026-10-06 09:35:43.209686','2026-10-06 09:35:43.209686');
/*!40000 ALTER TABLE `organizational_units` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `last_used_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_token_hash` (`token_hash`),
  KEY `ix_refresh_tokens_expires_at` (`expires_at`),
  KEY `ix_refresh_tokens_user_id` (`user_id`),
  CONSTRAINT `fk_refresh_tokens_user_id_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES
(1,1,'64d7f5d8f4b9fb50357426336e824391ec5f64610254cf143af2ce6dc2289a9c','2026-10-13 10:41:02.780041',NULL,NULL,'2026-10-06 10:41:02.800189'),
(2,1,'46d005f091092f01554b0a55739229a75c5b3bee621357d57d8ec8e7e825ca85','2026-10-13 10:42:47.699779',NULL,NULL,'2026-10-06 10:42:47.714163'),
(3,1,'c2c589b9cb46277a4564eadb99b8b1036b812dc158fa7ff3c1b1cf33dfcbd87b','2026-10-13 10:42:48.063729',NULL,NULL,'2026-10-06 10:42:48.071365'),
(4,1,'487252ff057c50ef39f246112ed96e48973cee822e03d4752f03495d3bdaf81a','2026-10-13 10:42:48.086609',NULL,'2026-10-06 10:42:48.100542','2026-10-06 10:42:48.092108'),
(5,1,'c8db4c684c4d399ccc971fb1886eb47894fa506145bba3d0650fd72dfcfbbc0d','2026-10-13 10:43:47.563905',NULL,NULL,'2026-10-06 10:43:47.578355'),
(6,1,'682e73a551e51510e447a5cbc00bdacfca95882b1599844ccd32085b5bb555c8','2026-10-13 10:43:47.656234',NULL,NULL,'2026-10-06 10:43:47.661905'),
(7,1,'a7fd85cfbfc0d652c523f5573e49ee7f2ee3de5a0d1dd22f5a62ef274a37f5b9','2026-10-13 10:43:47.677544',NULL,'2026-10-06 10:43:47.690160','2026-10-06 10:43:47.683053'),
(8,1,'de7d6af1891f0aeca4c4bc3164701e95682000b73251707dad6af7d9a7483053','2026-10-13 10:44:33.869697',NULL,NULL,'2026-10-06 10:44:33.883903'),
(9,1,'58bd4cec16d5b6a85a0351a05b5f02f2784aa768d6cd82c18e53433d3dabd5df','2026-10-13 10:44:33.960520',NULL,NULL,'2026-10-06 10:44:33.965750'),
(10,1,'e5badb1655aa05bd115d3941b953da9cbef6361856d109644f49566e630ebfda','2026-10-13 10:44:33.980952',NULL,'2026-10-06 10:44:33.993354','2026-10-06 10:44:33.987029'),
(11,1,'6bf08b14d14aa722acea3e1055a3dde2e255e792d9c70ceaf16bcb8ace525879','2026-10-13 11:54:49.105975',NULL,NULL,'2026-10-06 11:54:49.132299'),
(12,1,'76dcd95ec2c9dec9f200d764034c54287bfad225f0b3b60f5109a20d86511979','2026-10-13 11:54:49.218761',NULL,NULL,'2026-10-06 11:54:49.224254'),
(13,1,'453d258f29bee5c7257d39f8a0dd58b454885d6599c90e5f6f215f478e9b68e5','2026-10-13 11:54:49.238855',NULL,'2026-10-06 11:54:49.253445','2026-10-06 11:54:49.246162'),
(14,1,'ed04160886978341981d60a251d806dc4a4919933bdd4cac9dc8ab6751f686e6','2026-10-14 10:57:06.293723',NULL,NULL,'2026-10-07 10:57:06.318927'),
(15,1,'d51d679d21173fe09f99a3d5da2725507444380f30cbf79f6cc5eee64bbd48c6','2026-10-14 10:57:12.394212',NULL,NULL,'2026-10-07 10:57:12.405462'),
(16,1,'1fbcaac92a549bdff1b8b89ea283aa9bb5590697976a57ab73a2bb973cae904b','2026-10-14 10:57:18.468444',NULL,NULL,'2026-10-07 10:57:18.475543'),
(17,1,'09053bf21e3bd709d204f1b396d8dc9a168d78b002b25aeb88044d638ed7a6a3','2026-10-14 10:57:24.453500',NULL,NULL,'2026-10-07 10:57:24.459937'),
(18,1,'cde35d3161d4dd0c1367f1bc5e3b3911a8394c1f33f293bba6753aa88ed5d0ab','2026-10-14 11:36:38.483851',NULL,NULL,'2026-10-07 11:36:38.634954'),
(19,1,'b1ba33c7df731d8ce931eca971189442a9427b15db7c0e95b5f573668bc87e84','2026-10-14 14:09:29.482550','2026-10-07 14:17:33.385021',NULL,'2026-10-07 14:09:29.572158'),
(20,1,'03b08bb8b23f739a8263a1ff6186c75c244b98dbd8d945c6c26c7d55aa80b071','2026-10-15 09:14:29.859034',NULL,NULL,'2026-10-08 09:14:29.923216'),
(21,1,'95724817fc0e8ea77688d01906a75cc239c162b7b10787d5da6211ee82b79671','2026-10-15 09:14:44.756172',NULL,NULL,'2026-10-08 09:14:44.763370'),
(22,1,'77ba78f7f703292e7df39c9a9a7d0bc1f43c5754a8fa24d276267c8dcf125e71','2026-10-26 07:50:04.340090',NULL,NULL,'2026-10-19 07:50:04.435499'),
(23,1,'702780f0c8d789718968400274d3d6a22008db8c01b732fed413b48a013de997','2026-10-26 09:18:47.102647',NULL,NULL,'2026-10-19 09:18:47.120121');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `return_items`
--

DROP TABLE IF EXISTS `return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `return_id` bigint(20) unsigned NOT NULL,
  `borrowing_item_id` bigint(20) unsigned NOT NULL,
  `asset_id` bigint(20) unsigned NOT NULL,
  `final_condition` varchar(20) NOT NULL,
  `completeness` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `asset_status_after` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_return_items_asset_id` (`asset_id`),
  KEY `ix_return_items_borrowing_item_id` (`borrowing_item_id`),
  KEY `ix_return_items_return_id` (`return_id`),
  CONSTRAINT `fk_return_items_asset_id_assets` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_return_items_borrowing_item_id_borrowing_items` FOREIGN KEY (`borrowing_item_id`) REFERENCES `borrowing_items` (`id`),
  CONSTRAINT `fk_return_items_return_id_returns` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`),
  CONSTRAINT `ck_return_items_final_condition` CHECK (`final_condition` in ('BAIK','RUSAK','HILANG'))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_items`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `return_items` WRITE;
/*!40000 ALTER TABLE `return_items` DISABLE KEYS */;
INSERT INTO `return_items` VALUES
(1,1,5,16,'BAIK','Lengkap','Barang kembali mulus','2026-10-06 10:43:47.918952',NULL),
(2,2,6,17,'RUSAK',NULL,NULL,'2026-10-06 10:43:48.397780',NULL),
(3,3,9,22,'BAIK','Lengkap','Barang kembali mulus','2026-10-06 10:44:34.224642',NULL),
(4,4,10,23,'RUSAK',NULL,NULL,'2026-10-06 10:44:34.293565',NULL),
(5,5,13,28,'BAIK','Lengkap','Barang kembali mulus','2026-10-06 11:54:49.562543',NULL),
(6,6,14,29,'RUSAK',NULL,NULL,'2026-10-06 11:54:49.652303',NULL);
/*!40000 ALTER TABLE `return_items` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `returns`
--

DROP TABLE IF EXISTS `returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `returns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `borrowing_id` bigint(20) unsigned NOT NULL,
  `received_by` bigint(20) unsigned NOT NULL,
  `returned_at` datetime(6) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_returns_borrowing_id` (`borrowing_id`),
  KEY `ix_returns_received_by` (`received_by`),
  KEY `ix_returns_returned_at` (`returned_at`),
  CONSTRAINT `fk_returns_borrowing_id_borrowings` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings` (`id`),
  CONSTRAINT `fk_returns_received_by_users` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `returns`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `returns` WRITE;
/*!40000 ALTER TABLE `returns` DISABLE KEYS */;
INSERT INTO `returns` VALUES
(1,10,1,'2026-10-06 10:43:47.908683',NULL,'2026-10-06 10:43:47.910718'),
(2,11,1,'2026-10-06 10:43:48.392210',NULL,'2026-10-06 10:43:48.393485'),
(3,16,1,'2026-10-06 10:44:34.217232',NULL,'2026-10-06 10:44:34.218853'),
(4,17,1,'2026-10-06 10:44:34.289447',NULL,'2026-10-06 10:44:34.290204'),
(5,22,1,'2026-10-06 11:54:49.547728',NULL,'2026-10-06 11:54:49.550860'),
(6,23,1,'2026-10-06 11:54:49.648145',NULL,'2026-10-06 11:54:49.649066');
/*!40000 ALTER TABLE `returns` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '[]' CHECK (json_valid(`permissions`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_code` (`code`),
  KEY `ix_roles_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES
(1,'ADMIN','Administrator Sistem',NULL,1,'2026-10-06 09:35:43.217078','2026-10-19 11:37:07.260976','[\"audit.view\", \"borrowing.manage\", \"borrowing.view\", \"dashboard.view\", \"inventory.manage\", \"inventory.view\", \"masterdata.manage\", \"monitoring.view\", \"notification.manage\", \"notification.view\", \"qr.manage\", \"report.export\", \"report.view\", \"return.manage\", \"settings.manage\", \"users.manage\"]'),
(2,'SARPRAS','Petugas Sarpras',NULL,1,'2026-10-06 09:35:43.217078','2026-10-19 11:37:07.262820','[\"borrowing.manage\", \"borrowing.view\", \"dashboard.view\", \"inventory.manage\", \"inventory.view\", \"masterdata.manage\", \"monitoring.view\", \"notification.manage\", \"notification.view\", \"qr.manage\", \"report.export\", \"report.view\", \"return.manage\"]'),
(3,'PIMPINAN','Pimpinan / Kepala Sekolah',NULL,1,'2026-10-06 09:35:43.217078','2026-10-19 11:37:07.263474','[\"borrowing.view\", \"dashboard.view\", \"inventory.view\", \"monitoring.view\", \"notification.view\", \"report.export\", \"report.view\"]');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `scheduler_runs`
--

DROP TABLE IF EXISTS `scheduler_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduler_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `run_date` date NOT NULL,
  `trigger` varchar(30) NOT NULL,
  `triggered_by` bigint(20) unsigned DEFAULT NULL,
  `checked` int(11) NOT NULL,
  `late_marked` int(11) NOT NULL,
  `sent` int(11) NOT NULL,
  `skipped` int(11) NOT NULL,
  `failed` int(11) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_scheduler_runs_run_date` (`run_date`),
  KEY `ix_scheduler_runs_triggered_by` (`triggered_by`),
  CONSTRAINT `fk_scheduler_runs_triggered_by_users` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduler_runs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `scheduler_runs` WRITE;
/*!40000 ALTER TABLE `scheduler_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `scheduler_runs` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(150) NOT NULL,
  `value` text DEFAULT NULL,
  `value_type` varchar(20) NOT NULL DEFAULT 'STRING',
  `is_secret` tinyint(1) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_key` (`key`),
  KEY `ix_system_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_system_settings_updated_by_users` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_system_settings_value_type` CHECK (`value_type` in ('STRING','INTEGER','FLOAT','BOOLEAN','JSON'))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES
(1,'system.app_name','SIIPB SMK Negeri 1','STRING',0,NULL,NULL,'2026-10-06 09:35:43.252105','2026-10-06 09:35:43.252105'),
(2,'smtp.host','smtp.gmail.com','STRING',0,NULL,NULL,'2026-10-06 09:35:43.252105','2026-10-06 09:35:43.252105'),
(3,'smtp.port','587','INTEGER',0,NULL,NULL,'2026-10-06 09:35:43.252105','2026-10-06 09:35:43.252105'),
(4,'security.jwt_access_ttl_minutes','60','INTEGER',0,NULL,NULL,'2026-10-06 09:35:43.252105','2026-10-06 09:35:43.252105'),
(5,'security.jwt_refresh_ttl_days','7','INTEGER',0,NULL,NULL,'2026-10-06 09:35:43.252105','2026-10-06 09:35:43.252105');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(150) NOT NULL,
  `unit_id` bigint(20) unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  `google_subject` varchar(255) DEFAULT NULL,
  `google_email` varchar(255) DEFAULT NULL,
  `google_linked_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_google_subject` (`google_subject`),
  KEY `ix_users_deleted_at` (`deleted_at`),
  KEY `ix_users_is_active` (`is_active`),
  KEY `ix_users_unit_id` (`unit_id`),
  KEY `ix_users_role_id` (`role_id`),
  CONSTRAINT `fk_users_role_id_roles` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_users_unit_id_organizational_units` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'admin','admin@siipb.sch.id','scrypt:32768:8:1$4STWtpjLv5LnU9In$ccd64b4e277d13bb13a56505d289f67c6194f0ad756fba0f437c08b25a1877b26a0586dd3fe3143b99bf4ba94c9674883e9fdb8a6d48e41bb612d6998040d53d','Administrator SIIPB',4,1,'2026-10-19 09:18:47.102647','2026-10-06 09:35:43.223220','2026-10-19 10:18:44.973077',NULL,NULL,1,NULL,NULL,NULL),
(2,'petugas','petugas@siipb.sch.id','pbkdf2:sha256:petugas123','Budi Sarpras',4,1,NULL,'2026-10-06 09:35:43.223220','2026-10-19 10:18:44.973077',NULL,NULL,2,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Dumping events for database 'siipb'
--

--
-- Dumping routines for database 'siipb'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-10-19 11:47:28
