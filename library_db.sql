-- =============================================
-- Library SaaS - MySQL Database Schema
-- Import this file in phpMyAdmin
-- =============================================

CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  genre VARCHAR(100) DEFAULT 'Unknown',
  year INT DEFAULT 2024,
  isbn VARCHAR(50),
  quantity INT DEFAULT 1,
  available TINYINT(1) DEFAULT 1,
  borrowedBy VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity / Borrow history table
CREATE TABLE IF NOT EXISTS activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookId INT,
  bookTitle VARCHAR(255),
  userName VARCHAR(100),
  action ENUM('borrowed', 'returned') NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE SET NULL
);

-- Default admin user (password: admin123)
INSERT IGNORE INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@library.com', 'admin123', 'admin');

-- Seed books
INSERT IGNORE INTO books (id, title, author, genre, year) VALUES
(1, 'The Great Gatsby', 'F. Scott Fitzgerald', 'Classic', 1925),
(2, '1984', 'George Orwell', 'Dystopian', 1949),
(3, 'To Kill a Mockingbird', 'Harper Lee', 'Classic', 1960),
(4, 'The Catcher in the Rye', 'J.D. Salinger', 'Classic', 1951),
(5, 'Moby-Dick', 'Herman Melville', 'Adventure', 1851),
(6, 'Pride and Prejudice', 'Jane Austen', 'Romance', 1813),
(7, 'Brave New World', 'Aldous Huxley', 'Dystopian', 1932),
(8, 'The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 1937),
(9, 'War and Peace', 'Leo Tolstoy', 'Historical', 1869),
(10, 'Crime and Punishment', 'Fyodor Dostoevsky', 'Psychological', 1866),
(11, 'The Odyssey', 'Homer', 'Epic', -800),
(12, 'Ulysses', 'James Joyce', 'Modernist', 1922),
(13, 'One Hundred Years of Solitude', 'Gabriel García Márquez', 'Magic Realism', 1967),
(14, 'The Brothers Karamazov', 'Fyodor Dostoevsky', 'Philosophical', 1880),
(15, 'Anna Karenina', 'Leo Tolstoy', 'Realist', 1877),
(16, 'Wuthering Heights', 'Emily Brontë', 'Gothic', 1847),
(17, 'Jane Eyre', 'Charlotte Brontë', 'Romance', 1847),
(18, 'The Divine Comedy', 'Dante Alighieri', 'Epic', 1320),
(19, 'Les Misérables', 'Victor Hugo', 'Historical', 1862),
(20, 'The Iliad', 'Homer', 'Epic', -750);
