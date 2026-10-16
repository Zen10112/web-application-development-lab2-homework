export interface Employee {
  ID: number;
  Name: string;
  Department: string;
  Position: string;
  Salary: number;
}

const names = [
  "Nguyen Van An",
  "Tran Thi Binh",
  "Le Minh Cuong",
  "Pham Thi Dung",
  "Hoang Van Em",
  "Vo Thi Giang",
  "Dang Minh Huy",
  "Bui Thi Hoa",
  "Do Van Khang",
  "Ngo Thi Lan",
  "Duong Minh Long",
  "Ly Thi Mai",
  "Truong Van Nam",
  "Phan Thi Ngoc",
  "Cao Minh Phuc",
  "Mai Thi Quynh",
  "Dinh Van Son",
  "Huynh Thi Thao",
  "Ta Minh Tuan",
  "Chu Thi Uyen",
  "Nguyen Duc Viet",
  "Tran Thi Xuan",
  "Le Hoang Bao",
  "Pham Minh Chau",
  "Hoang Duc Dat",
  "Vo Thi Ha",
  "Dang Quoc Hieu",
  "Bui Thanh Lam",
  "Do Thi My",
  "Ngo Minh Quan",
];

const departments = [
  "Engineering",
  "Human Resources",
  "Marketing",
  "Finance",
  "Sales",
];

const positions = [
  "Software Engineer",
  "HR Specialist",
  "Marketing Executive",
  "Financial Analyst",
  "Sales Executive",
];

export const employees: Employee[] = names.map((name, index) => {
  const departmentIndex = index % departments.length;

  return {
    ID: index + 1,
    Name: name,
    Department: departments[departmentIndex],
    Position: positions[departmentIndex],
    Salary: 10000000 + index * 500000,
  };
});
